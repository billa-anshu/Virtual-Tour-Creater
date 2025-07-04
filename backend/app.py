import sys
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
from urllib.parse import quote
# from stitcher import stitch_images  # Your stitching logic - Assuming stitcher.py is available
from supabase import create_client, Client
import uuid
import io
import shutil
import cv2
import json
import traceback
import numpy as np # Import numpy for image processing
from stitcher import stitch_images

app = Flask(__name__)
CORS(app, origins=[
    "https://virtual-tour-creater.vercel.app",
    "http://localhost:3000"  # for local development
])

# --- Configuration for temporary local storage ---
UPLOAD_FOLDER = 'uploads'
TEMP_OUTPUT_FOLDER = 'temp_panoramas'

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEMP_OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['TEMP_OUTPUT_FOLDER'] = TEMP_OUTPUT_FOLDER

# --- Supabase Configuration ---
SUPABASE_URL = 'https://fogqiruqayzamorywwkl.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvZ3FpcnVxYXl6YW1vcnl3d2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NjAxODAsImV4cCI6MjA2NjUzNjE4MH0.fa0st9V3allcHbD-Nklnh9ajYLRXgwSXWMnxBhp81hA'
SUPABASE_BUCKET_NAME = "tour-images"
SUPABASE_AUDIO_BUCKET_NAME = "tour-audio" # New: Supabase bucket for audio
SUPABASE_PANORAMAS_TABLE = "panoramas"
SUPABASE_MARKERS_TABLE = "markers"
SUPABASE_TOOLTIPS_TABLE = "tooltips"
SUPABASE_TOURS_TABLE = "tour"
SUPABASE_TOUR_AUDIO_TABLE = "tour_audio" # New: Supabase table for audio URLs

# Initialize Supabase Client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase client initialized successfully.")
except Exception as e:
    print(f"❌ Error initializing Supabase client: {e}")
    pass


def calculate_view_constraints(image):
    """
    Calculates view constraints based on non-black pixel boundaries.
    Uses more robust contour detection and handles potential edge cases.
    """
    if image is None:
        return {'minYaw': 0, 'maxYaw': 2 * np.pi, 'minPitch': -np.pi / 2, 'maxPitch': np.pi / 2}

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    thresh = cv2.erode(thresh, None, iterations=2)  # Reduce noise
    thresh = cv2.dilate(thresh, None, iterations=2) # Fill gaps

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return {'minYaw': 0, 'maxYaw': 2 * np.pi, 'minPitch': -np.pi / 2, 'maxPitch': np.pi / 2}

    c = max(contours, key=cv2.contourArea)
    mask = np.zeros_like(gray)
    cv2.drawContours(mask, [c], -1, 255, -1)
    y_coords, x_coords = np.where(mask > 0)

    if not x_coords.size or not y_coords.size:
        return {'minYaw': 0, 'maxYaw': 2 * np.pi, 'minPitch': -np.pi / 2, 'maxPitch': np.pi / 2}

    min_x, max_x = np.min(x_coords), np.max(x_coords)
    min_y, max_y = np.min(y_coords), np.max(y_coords)

    height, width = image.shape[:2]
    center_x = width / 2
    center_y = height / 2

    # Convert pixel coordinates to angles (simplified)
    # These calculations are approximations and might need fine-tuning
    # based on the specific panorama projection and desired behavior.
    # For a perfect equirectangular projection, more complex formulas are needed.
    # Here, we're doing a linear mapping based on bounding box.
    left_angle = np.arctan2(min_x - center_x, center_y)
    right_angle = np.arctan2(max_x - center_x, center_y)
    top_angle = np.arctan2(center_x, min_y - center_y)
    bottom_angle = np.arctan2(center_x, max_y - center_y)

    return {
        'minYaw': left_angle,
        'maxYaw': right_angle,
        'minPitch': -bottom_angle, # Pitch usually goes from -pi/2 (down) to pi/2 (up)
        'maxPitch': -top_angle,
    }


# --- Helper Function for Image Processing and Supabase Upload ---
def process_room_images(tour_id, room_name, room_files):
    """
    Handles saving raw images locally, stitching them, and uploading the panorama
    to Supabase Storage. Returns the public URL of the uploaded panorama.
    """
    print(f"\n➡️ [process_room_images] Processing Room: {room_name} for Tour ID: {tour_id}")
    image_paths = []

    temp_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], str(tour_id), secure_filename(room_name) + "_" + str(uuid.uuid4()))
    os.makedirs(temp_upload_dir, exist_ok=True)
    print(f"    [process_room_images] Created temporary upload directory: {temp_upload_dir}")

    for idx, file in enumerate(room_files):
        if file and file.filename:
            filename = secure_filename(file.filename)
            save_path = os.path.join(temp_upload_dir, f"IMG-{idx+1}_{filename}")
            file.save(save_path)
            image_paths.append(save_path)
            print(f"    [process_room_images] ✅ Saved temporary image: {save_path}")
        else:
            print(f"    [process_room_images] ⚠️ Skipping empty or invalid file at index {idx}.")

    if not image_paths:
        if os.path.exists(temp_upload_dir):
            shutil.rmtree(temp_upload_dir)
            print(f"    [process_room_images] Cleaned up empty temporary upload directory: {temp_upload_dir}")
        raise Exception(f"No valid images uploaded for {room_name}")

    stitched_output_filename_local = f"{secure_filename(room_name)}_panorama_temp_{uuid.uuid4()}.jpg"
    stitched_output_path_local = os.path.join(app.config['TEMP_OUTPUT_FOLDER'], stitched_output_filename_local)

    print(f"    [process_room_images] 🧵 Stitching images locally → {stitched_output_path_local}")
    stitched_image_np = None
    try:
        success, stitched_image_np = stitch_images(image_paths, stitched_output_path_local)
        if not success:
            raise Exception(f"Stitching failed for {room_name}. Check stitcher.py logs for details.")
        print(f"    [process_room_images] Stitching completed successfully for {room_name}.")
    except Exception as e:
        print(f"    [process_room_images] ❌ Error during stitching: {e}")
        if os.path.exists(temp_upload_dir):
            shutil.rmtree(temp_upload_dir)
            print(f"    [process_room_images] Cleaned up temporary upload directory on stitch error: {temp_upload_dir}")
        if os.path.exists(stitched_output_path_local):
            os.remove(stitched_output_path_local)
            print(f"    [process_room_images] Cleaned up temporary stitched file on stitch error: {stitched_output_path_local}")
        raise e

    if stitched_image_np is None:
        raise Exception(f"Stitched image (numpy array) is None for room {room_name}.")

    try:
        _, img_encoded = cv2.imencode('.jpg', stitched_image_np)
        img_bytes = img_encoded.tobytes()
        print(f"    [process_room_images] Converted stitched image to bytes (size: {len(img_bytes)} bytes).")
    except Exception as e:
        print(f"    [process_room_images] ❌ Error encoding image to bytes: {e}")
        raise Exception(f"Error encoding image for upload: {e}")

    supabase_file_path = f"{tour_id}/{quote(room_name.replace(' ', '_'))}_panorama.jpg"

    print(f"    [process_room_images] ☁️ Uploading stitched panorama to Supabase Storage: {supabase_file_path}")
    panorama_url = None
    try:
        upload_result = supabase.storage.from_(SUPABASE_BUCKET_NAME).upload(
            file=img_bytes,
            path=supabase_file_path,
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )

        print(f"    [process_room_images] Raw upload_result from Supabase: {upload_result}")

        if hasattr(upload_result, 'path') and upload_result.path:
            print(f"    [process_room_images] ✅ Supabase Storage upload successful. Response: {upload_result}")
            public_url = supabase.storage.from_(SUPABASE_BUCKET_NAME).get_public_url(supabase_file_path)
            if public_url:
                panorama_url = public_url
                print(f"    [process_room_images] ✅ Supabase Public URL: {panorama_url}")
            else:
                raise Exception("Failed to get public URL from Supabase after upload.")
        else:
            print(f"    [process_room_images] ❌ Supabase Storage upload failed. Unexpected response: {upload_result}")
            raise Exception(f"Supabase Storage upload failed: Unexpected response type or content. Raw response: {upload_result}")

    except Exception as e:
        print(f"    [process_room_images] ❌ Supabase upload failed: {e}")
        raise Exception(f"Failed to upload panorama to Supabase: {e}")
    finally:
        if os.path.exists(temp_upload_dir):
            shutil.rmtree(temp_upload_dir)
            print(f"    [process_room_images] Cleaned up temporary upload directory: {temp_upload_dir}")
        if os.path.exists(stitched_output_path_local):
            os.remove(stitched_output_path_local)
            print(f"    [process_room_images] Cleaned up temporary stitched file: {stitched_output_path_local}")

    return panorama_url, stitched_image_np

# --- Flask Routes ---

@app.route('/stitch', methods=['POST'])
def stitch_tour_endpoint():
    print("\n--- Received POST request to /stitch ---")
    room_panorama_urls = {}
    tour_id = request.form.get('tourId')

    print(f"    [stitch_tour_endpoint] Received tourId: {tour_id}")

    if not tour_id:
        print("    [stitch_tour_endpoint] Error: Tour ID is missing in request form data.")
        return jsonify({'success': False, 'error': 'Tour ID is missing. Please provide a tourId.'}), 400

    try:
        print(f"    [stitch_tour_endpoint] Verifying/Creating tour entry for Tour ID: {tour_id}")

        tour_entry_response = supabase.table(SUPABASE_TOURS_TABLE).select("tour_id, start_room").eq("tour_id", tour_id).limit(1).execute()
        existing_tour_data = tour_entry_response.data[0] if tour_entry_response.data else None

        if not existing_tour_data:
            print(f"    [stitch_tour_endpoint] Tour ID {tour_id} not found in '{SUPABASE_TOURS_TABLE}'. Inserting new tour entry.")
            tour_name = request.form.get('tour_name')
            print(f"    [stitch_tour_endpoint] Received tour_name: {tour_name}")

            insert_tour_data = {"tour_id": tour_id}
            if tour_name:
                insert_tour_data["tour_name"] = tour_name
            # Do NOT set start_room here. It will be set after the first panorama is processed.

            insert_tour_res = supabase.table(SUPABASE_TOURS_TABLE).insert(insert_tour_data).execute()

            if not insert_tour_res.data:
                print(f"    [stitch_tour_endpoint] ❌ Failed to create tour entry for {tour_id}. Error: {insert_tour_res.error}")
                raise Exception(f"Failed to create tour entry in '{SUPABASE_TOURS_TABLE}': {insert_tour_res.error}")
            print(f"    [stitch_tour_endpoint] ✅ Tour entry created for {tour_id}.")
        else:
            print(f"    [stitch_tour_endpoint] Tour ID {tour_id} already exists in '{SUPABASE_TOURS_TABLE}'.")

        room_files_map = {}
        if not request.files:
            print("    [stitch_tour_endpoint] No files found in request.files.")
            return jsonify({'success': False, 'error': 'No image files uploaded.'}), 400

        for key in request.files:
            room_name = key.rstrip('[]')
            room_files_map[room_name] = request.files.getlist(key)
            print(f"    [stitch_tour_endpoint] Found files for room '{room_name}': {len(room_files_map[room_name])} files.")

        first_room_processed = None
        for room_name, room_files in room_files_map.items():
            print(f"    [stitch_tour_endpoint] Initiating processing for room: {room_name}")
            url, stitched_image = process_room_images(tour_id, room_name, room_files)

            print(f"    [stitch_tour_endpoint] Upserting panorama URL to {SUPABASE_PANORAMAS_TABLE} for room: {room_name}")
            response = supabase.table(SUPABASE_PANORAMAS_TABLE).upsert({
                "tour_id": tour_id,
                "room_name": room_name,
                "panorama_url": url
            }, on_conflict="tour_id, room_name").execute()

            if response.data:
                room_panorama_urls[room_name] = url
                print(f"    [stitch_tour_endpoint] ✅ Saved panorama URL to Supabase DB for room: {room_name}. Response: {response.data}")

                # If this is the first room processed and no start_room is set for the tour, set it
                if first_room_processed is None and (not existing_tour_data or existing_tour_data.get('start_room') is None):
                    print(f"    [stitch_tour_endpoint] Setting '{room_name}' as start_room for tour '{tour_id}'.")
                    supabase.table(SUPABASE_TOURS_TABLE).update({"start_room": room_name}).eq("tour_id", tour_id).execute()
                    first_room_processed = room_name # Mark that a start room has been set
            else:
                print(f"    [stitch_tour_endpoint] ❌ Failed to save panorama URL to Supabase DB for room: {room_name}. Error: {response.error}")
                raise Exception(f"Failed to save panorama URL for {room_name} to database: {response.error}")

        print("--- All rooms processed and panoramas/metadata handled. Sending success response. ---")
        return jsonify({
            'success': True,
            'panoramaUrls': room_panorama_urls,
            'roomConnections': {}
        })
    except Exception as e:
        print(f"--- ❌ Stitch error in /stitch endpoint: {e} ---")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/restitch-room', methods=['POST'])
def restitch_room_endpoint():
    print("\n--- Received POST request to /restitch-room ---")
    tour_id = request.form.get('tourId')
    room_name = request.form.get('roomName')
    files = request.files.getlist('files')

    print(f"    [restitch_room_endpoint] Received tourId: {tour_id}, roomName: {room_name}, files: {len(files)}")

    if not tour_id or not room_name or not files:
        print("[restitch_room_endpoint] Error: Missing tour ID, room name, or files.")
        return jsonify({"success": False, "error": "Missing tour ID, room name, or files."}), 400

    print(f"    [restitch_room_endpoint] 🔁 Restitching single room: {room_name} for Tour ID: {tour_id}")

    try:
        processed_result = process_room_images(tour_id, room_name, files)
        new_panorama_url = processed_result[0]
        if not new_panorama_url:
            raise Exception("Failed to get new panorama URL after processing images.")

        print(f"    [restitch_room_endpoint] New panorama URL after processing: {new_panorama_url}")

        print("    [restitch_room_endpoint] Attempting to update panorama URL in panoramas table.")
        update_response = supabase.table(SUPABASE_PANORAMAS_TABLE).update(
            {"panorama_url": new_panorama_url}
        ).eq("tour_id", tour_id).eq("room_name", room_name).execute()

        if update_response.data and len(update_response.data) > 0:
            print("    [restitch_room_endpoint] ✅ Panorama URL updated in Supabase DB.")
        else:
            print("    [restitch_room_endpoint] No existing panorama found, inserting new one.")
            insert_response = supabase.table(SUPABASE_PANORAMAS_TABLE).insert(
                {"tour_id": tour_id, "room_name": room_name, "panorama_url": new_panorama_url}
            ).execute()
            if not insert_response.data:
                print(f"    [restitch_room_endpoint] ❌ Failed to insert new panorama. Error: {insert_response.error}")
                raise Exception(f"Failed to insert new panorama for {room_name}: {insert_response.error}")
            print("    [restitch_room_endpoint] ✅ New panorama inserted into Supabase DB.")

        print(f"    [restitch_room_endpoint] Clearing markers from/to room: {room_name}")
        supabase.table(SUPABASE_MARKERS_TABLE).delete().eq("tour_id", tour_id).eq("from_room", room_name).execute()
        supabase.table(SUPABASE_MARKERS_TABLE).delete().eq("tour_id", tour_id).eq("to_room", room_name).execute()
        print("    [restitch_room_endpoint] ✅ Markers associated with room cleared from DB.")

        print(f"    [restitch_room_endpoint] Clearing tooltips from room: {room_name}")
        supabase.table(SUPABASE_TOOLTIPS_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()
        print("    [restitch_room_endpoint] ✅ Tooltips associated with room cleared from DB.")

        print("--- Room re-stitch and associated data clear completed. Sending success response. ---")
        return jsonify({"success": True, "message": "Room re-stitched successfully and markers/tooltips cleared!", "panoramaUrl": new_panorama_url}), 200

    except Exception as e:
        print(f"--- ❌ Error in /restitch-room endpoint: {e} ---")
        return jsonify({"success": False, "message": f"Server error re-stitching room: {str(e)}"}), 500


@app.route('/rename-room', methods=['POST'])
def rename_room_endpoint():
    print("\n--- Received POST request to /rename-room ---")
    data = request.json

    if not data:
        print("[rename_room_endpoint] Error: No JSON data received.")
        return jsonify({"success": False, "error": "No JSON data received in request body."}), 400

    try:
        tour_id = data['tourId']
        old_room_name = data['oldRoomName']
        new_room_name = data['newRoomName']
    except KeyError as e:
        print(f"[rename_room_endpoint] KeyError: Missing expected JSON key: {e}")
        return jsonify({"success": False, "error": f"Missing data in request body: {e}. Check key names in frontend POST request."}), 400

    if not tour_id:
        print("    [rename_room_endpoint] Error: Tour ID is missing.")
        return jsonify({'success': False, 'error': 'Tour ID is missing'}), 400
    if not old_room_name or not new_room_name:
        print("    [rename_room_endpoint] Error: Invalid old or new room names provided.")
        return jsonify({"success": False, "message": "Invalid room names!"}), 400
    if old_room_name == new_room_name:
        print("    [rename_room_endpoint] Room name is the same, no action taken.")
        return jsonify({"success": True, "message": "Room name is the same, no action taken."})

    print(f"    [rename_room_endpoint] 🔁 Renaming room for Tour ID: {tour_id} from '{old_room_name}' to '{new_room_name}'")

    try:
        print(f"    [rename_room_endpoint] Updating room_name in {SUPABASE_PANORAMAS_TABLE} from '{old_room_name}' to '{new_room_name}'.")
        pan_res = supabase.table(SUPABASE_PANORAMAS_TABLE).update({"room_name": new_room_name}).eq("tour_id", tour_id).eq("room_name", old_room_name).execute()
        if not pan_res.data:
            print(f"    [rename_room_endpoint] ⚠️ Could not find panorama entry to update for '{old_room_name}'. It might not exist or already be renamed.")
        else:
            print(f"    [rename_room_endpoint] ✅ Panorama entry updated in DB. Affected rows: {len(pan_res.data)}")

        print(f"    [rename_room_endpoint] Updating from_room in {SUPABASE_MARKERS_TABLE}.")
        supabase.table(SUPABASE_MARKERS_TABLE).update({"from_room": new_room_name}).eq("tour_id", tour_id).eq("from_room", old_room_name).execute()
        print(f"    [rename_room_endpoint] Updating to_room in {SUPABASE_MARKERS_TABLE}.")
        supabase.table(SUPABASE_MARKERS_TABLE).update({"to_room": new_room_name}).eq("tour_id", tour_id).eq("to_room", old_room_name).execute()
        print("    [rename_room_endpoint] ✅ Markers updated in DB.")

        print(f"    [rename_room_endpoint] Updating room_name in {SUPABASE_TOOLTIPS_TABLE}.")
        supabase.table(SUPABASE_TOOLTIPS_TABLE).update({"room_name": new_room_name}).eq("tour_id", tour_id).eq("room_name", old_room_name).execute()
        print("    [rename_room_endpoint] ✅ Tooltips updated in DB.")

        # Check and update start_room in SUPABASE_TOURS_TABLE
        print(f"    [rename_room_endpoint] Checking and updating start_room in {SUPABASE_TOURS_TABLE}.")
        tour_check_res = supabase.table(SUPABASE_TOURS_TABLE).select("start_room").eq("tour_id", tour_id).limit(1).execute()
        if tour_check_res.data and tour_check_res.data[0]['start_room'] == old_room_name:
            supabase.table(SUPABASE_TOURS_TABLE).update({"start_room": new_room_name}).eq("tour_id", tour_id).execute()
            print(f"    [rename_room_endpoint] ✅ Start room updated in DB.")

        old_file_path_in_bucket = f"{tour_id}/{quote(old_room_name.replace(' ', '_'))}_panorama.jpg"
        new_file_path_in_bucket = f"{tour_id}/{quote(new_room_name.replace(' ', '_'))}_panorama.jpg"

        print(f"    [rename_room_endpoint] Attempting to rename file in Supabase Storage from '{old_file_path_in_bucket}' to '{new_file_path_in_bucket}'")
        try:
            supabase.storage.from_(SUPABASE_BUCKET_NAME).copy(old_file_path_in_bucket, new_file_path_in_bucket)
            print(f"    [rename_room_endpoint] ✅ File copied in Supabase Storage.")

            supabase.storage.from_(SUPABASE_BUCKET_NAME).remove([old_file_path_in_bucket])
            print(f"    [rename_room_endpoint] ✅ Old file deleted from Supabase Storage.")

            new_public_url = supabase.storage.from_(SUPABASE_BUCKET_NAME).get_public_url(new_file_path_in_bucket)
            if new_public_url:
                supabase.table(SUPABASE_PANORAMAS_TABLE).update({"panorama_url": new_public_url}).eq("tour_id", tour_id).eq("room_name", new_room_name).execute()
                print(f"    [rename_room_endpoint] ✅ Panorama URL updated in DB to new file path: {new_public_url}.")
            else:
                print(f"    [rename_room_endpoint] ⚠️ Could not get new public URL for '{new_file_path_in_bucket}'.")

        except Exception as e:
            print(f"    [rename_room_endpoint] ❌ Error renaming file in Supabase Storage: {e}")
            pass

        print("--- Room rename and associated data updates completed. Sending success response. ---")
        return jsonify({"success": True, "message": "Room and associated data renamed successfully!"})
    except Exception as e:
        print(f"--- ❌ Error in /rename-room endpoint: {e} ---")
        return jsonify({"success": False, "message": f"Server error renaming room: {str(e)}"}), 500


@app.route('/delete-room', methods=['POST'])
def delete_room_endpoint():
    print("\n--- Received POST request to /delete-room ---")
    try:
        data = request.get_json()

        if not data:
            print("[delete_room_endpoint] Error: No JSON data received.")
            return jsonify({"success": False, "error": "No JSON data received in request body."}), 400

        tour_id = data.get('tourId')
        room_name = data.get('roomName')

        if not tour_id:
            print("    [delete_room_endpoint] Error: Tour ID is missing.")
            return jsonify({'success': False, 'error': 'Tour ID is missing'}), 400
        if not room_name:
            print("    [delete_room_endpoint] Error: Room name not provided.")
            return jsonify({"success": False, "message": "Room name not provided."}), 400

        print(f"    [delete_room_endpoint] 🗑️ Deleting room: {room_name} for Tour ID: {tour_id}")

        file_path_in_bucket = f"{tour_id}/{quote(room_name.replace(' ', '_'))}_panorama.jpg"
        try:
            print(f"    [delete_room_endpoint] ☁️ Deleting file from Supabase Storage: {file_path_in_bucket}")
            supabase.storage.from_(SUPABASE_BUCKET_NAME).remove([file_path_in_bucket])
            print("    [delete_room_endpoint] ✅ Panorama file deleted from Supabase Storage.")
        except Exception as e:
            print(f"    [delete_room_endpoint] ⚠️ Could not delete file from Supabase Storage (might not exist or other error): {e}")
            pass

        print(f"    [delete_room_endpoint] Deleting panorama entries from {SUPABASE_PANORAMAS_TABLE}.")
        pan_del_res = supabase.table(SUPABASE_PANORAMAS_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()
        print(f"    [delete_room_endpoint] ✅ Deleted {len(pan_del_res.data)} panorama entries from DB.")

        print(f"    [delete_room_endpoint] Deleting markers from/to room: {room_name} in {SUPABASE_MARKERS_TABLE}.")
        mark_from_del_res = supabase.table(SUPABASE_MARKERS_TABLE).delete().eq("tour_id", tour_id).eq("from_room", room_name).execute()
        mark_to_del_res = supabase.table(SUPABASE_MARKERS_TABLE).delete().eq("tour_id", tour_id).eq("to_room", room_name).execute()
        print(f"    [delete_room_endpoint] ✅ Deleted {len(mark_from_del_res.data) + len(mark_to_del_res.data)} marker entries from DB.")

        print(f"    [delete_room_endpoint] Deleting tooltips for room: {room_name} in {SUPABASE_TOOLTIPS_TABLE}.")
        tip_del_res = supabase.table(SUPABASE_TOOLTIPS_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()
        print(f"    [delete_room_endpoint] ✅ Deleted {len(tip_del_res.data)} tooltip entries from DB.")

        # New: Delete audio entry from tour_audio table
        print(f"    [delete_room_endpoint] Deleting audio for room: {room_name} in {SUPABASE_TOUR_AUDIO_TABLE}.")
        audio_del_res = supabase.table(SUPABASE_TOUR_AUDIO_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()
        print(f"    [delete_room_endpoint] ✅ Deleted {len(audio_del_res.data)} audio entries from DB.")

        # New: Delete audio file from Supabase Storage
        audio_file_path_in_bucket = f"{tour_id}/{quote(room_name.replace(' ', '_'))}_audio.mp3"
        try:
            print(f"    [delete_room_endpoint] ☁️ Deleting audio file from Supabase Storage: {audio_file_path_in_bucket}")
            supabase.storage.from_(SUPABASE_AUDIO_BUCKET_NAME).remove([audio_file_path_in_bucket])
            print("    [delete_room_endpoint] ✅ Audio file deleted from Supabase Storage.")
        except Exception as e:
            print(f"    [delete_room_endpoint] ⚠️ Could not delete audio file from Supabase Storage (might not exist or other error): {e}")
            pass


        print(f"    [delete_room_endpoint] Checking if deleted room was start_room in {SUPABASE_TOURS_TABLE}.")
        tour_res = supabase.table(SUPABASE_TOURS_TABLE).select("start_room").eq("tour_id", tour_id).limit(1).execute()
        if tour_res.data and tour_res.data[0]['start_room'] == room_name:
            print(f"    [delete_room_endpoint] Deleted room '{room_name}' was the start room. Finding new start room.")
            remaining_panoramas = supabase.table(SUPABASE_PANORAMAS_TABLE).select("room_name").eq("tour_id", tour_id).limit(1).execute()
            new_start_room = remaining_panoramas.data[0]['room_name'] if remaining_panoramas.data else None
            supabase.table(SUPABASE_TOURS_TABLE).update({"start_room": new_start_room}).eq("tour_id", tour_id).execute()
            print(f"    [delete_room_endpoint] ✅ Updated tour's start room to: {new_start_room}")

        print("--- Room deletion and associated data cleanup completed. Sending success response. ---")
        return jsonify({"success": True, "message": f"Room '{room_name}' and all associated data deleted."})
    except Exception as e:
        print(f"--- ❌ Error in /delete-room endpoint: {e} ---")
        return jsonify({"success": False, "message": f"Server error deleting room: {str(e)}"}), 500


@app.route('/get-tour-data/<tour_id>', methods=['GET'])
def get_tour_data_endpoint(tour_id):
    print(f"--- Received GET request to /get-tour-data/{tour_id} ---")
    try:
        tour_response= supabase.from_('tour').select('start_room').eq('tour_id', tour_id).single().execute()
        tour_data = tour_response.data
        if tour_response.count == 0 or not tour_data:
            print(f"[get_tour_data_endpoint] No tour found with ID: {tour_id}")
            return jsonify({'success': False, 'error': 'Tour not found.'}), 404

        start_room = tour_data.get('start_room')
        print(f"[get_tour_data_endpoint] Start room from tours table (raw): '{start_room}'")

        print("[get_tour_data_endpoint] Fetching panoramas from panoramas.")
        panoramas_response = supabase.from_('panoramas').select('room_name, panorama_url').eq('tour_id', tour_id).execute()
        panoramas = panoramas_response.data
        print(f"[get_tour_data_endpoint] Fetched {len(panoramas)} panoramas.")
        print(f"[get_tour_data_endpoint] Raw Panoramas Data: {json.dumps(panoramas, indent=2)}")

        panorama_urls = {}
        for p in panoramas:
            if 'room_name' in p and p['room_name'] is not None and 'panorama_url' in p and p['panorama_url'] is not None:
                panorama_urls[p['room_name']] = p['panorama_url']
            else:
                print(f"[get_tour_data_endpoint] Warning: Skipping panorama with missing room_name or panorama_url: {p}")

        print(f"[get_tour_data_endpoint] Panorama URLs compiled (valid rooms only): {list(panorama_urls.keys())}")

        final_start_room = None
        if start_room and start_room in panorama_urls:
            final_start_room = start_room
        else:
            if panoramas:
                first_valid_room = next((p['room_name'] for p in panoramas if p.get('room_name') and p['room_name'] in panorama_urls), None)
                if first_valid_room:
                    final_start_room = first_valid_room
                    print(f"[get_tour_data_endpoint] Defaulting start room to first valid panorama: '{final_start_room}'")
                else:
                    print("[get_tour_data_endpoint] No valid panoramas found to set as start room.")
                    return jsonify({'success': False, 'error': 'No valid panoramas uploaded for this tour or all have invalid names/URLs.'}), 404
            else:
                print("[get_tour_data_endpoint] No panoramas found at all for this tour.")
                return jsonify({'success': False, 'error': 'No panoramas uploaded for this tour.'}), 404

        print(f"[get_tour_data_endpoint] Final determined start room: '{final_start_room}'")


        print("[get_tour_data_endpoint] Fetching markers from markers.")
        markers_response = supabase.from_('markers').select('marker_id, from_room, to_room, position_x, position_y').eq('tour_id', tour_id).execute()
        markers_raw = markers_response.data
        print(f"[get_tour_data_endpoint] Fetched {len(markers_raw)} raw markers.")
        print(f"[get_tour_data_endpoint] Raw Markers Data: {json.dumps(markers_raw, indent=2)}")

        markers_data = {}
        for marker_item in markers_raw:
            required_marker_keys = ['from_room', 'to_room', 'position_x', 'position_y']
            if not all(key in marker_item and marker_item[key] is not None for key in required_marker_keys):
                print(f"[get_tour_data_endpoint] Warning: Skipping malformed marker (missing required data): {marker_item}")
                continue

            from_room = marker_item['from_room']
            if from_room in panorama_urls:
                if from_room not in markers_data:
                    markers_data[from_room] = []
                markers_data[from_room].append({
                    'id': marker_item.get('marker_id', str(uuid.uuid4())),
                    'linkTo': marker_item['to_room'],
                    'position': {'x': marker_item['position_x'], 'y': marker_item['position_y']}
                })
            else:
                print(f"[get_tour_data_endpoint] Warning: Skipping marker from unknown room '{from_room}' (not in panoramas): {marker_item}")

        print(f"[get_tour_data_endpoint] Organized markers for rooms: {list(markers_data.keys())}")

        print("[get_tour_data_endpoint] Fetching tooltips from tooltips.")
        tooltips_response=supabase.from_('tooltips').select('tooltip_id, room_name, content, position_x, position_y').eq('tour_id', tour_id).execute()
        tooltips_raw = tooltips_response.data
        print(f"[get_tour_data_endpoint] Fetched {len(tooltips_raw)} raw tooltips.")
        print(f"[get_tour_data_endpoint] Raw Tooltips Data: {json.dumps(tooltips_raw, indent=2)}")

        tooltips_data = {}
        for tooltip_item in tooltips_raw:
            required_tooltip_keys = ['room_name', 'content', 'position_x', 'position_y']
            if not all(key in tooltip_item and tooltip_item[key] is not None for key in required_tooltip_keys):
                print(f"[get_tour_data_endpoint] Warning: Skipping malformed tooltip (missing required data): {tooltip_item}")
                continue

            room_name = tooltip_item['room_name']
            if room_name in panorama_urls:
                if room_name not in tooltips_data:
                    tooltips_data[room_name] = []
                tooltips_data[room_name].append({
                    'id': tooltip_item.get('tooltip_id', str(uuid.uuid4())),
                    'content': tooltip_item['content'],
                    'position': {'x': tooltip_item['position_x'], 'y': tooltip_item['position_y']}
                })
            else:
                print(f"[get_tour_data_endpoint] Warning: Skipping tooltip from unknown room '{room_name}' (not in panoramas): {tooltip_item}")

        print(f"[get_tour_data_endpoint] Organized tooltips for rooms: {list(tooltips_data.keys())}")

        # New: Fetch audio data
        print("[get_tour_data_endpoint] Fetching audio from tour_audio.")
        audio_response = supabase.from_('tour_audio').select('room_name, audio_url').eq('tour_id', tour_id).execute()
        audio_raw = audio_response.data
        print(f"[get_tour_data_endpoint] Fetched {len(audio_raw)} raw audio entries.")

        audio_data = {}
        for audio_item in audio_raw:
            if 'room_name' in audio_item and 'audio_url' in audio_item:
                audio_data[audio_item['room_name']] = audio_item['audio_url']
            else:
                print(f"[get_tour_data_endpoint] Warning: Skipping malformed audio entry: {audio_item}")
        print(f"[get_tour_data_endpoint] Organized audio data for rooms: {list(audio_data.keys())}")


        response_data = {
            'success': True,
            'panoramaUrls': panorama_urls,
            'markers': markers_data,
            'tooltips': tooltips_data,
            'startRoom': final_start_room,
            'audioUrls': audio_data # New: Include audio URLs in the response
        }
        print("--- Tour data fetched successfully. Sending success response. ---")
        return jsonify(response_data), 200

    except Exception as e:
        print(f"--- ❌ Error in /get-tour-data endpoint: '{e}' ---")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/save-markers', methods=['POST'])
def save_markers_endpoint():
    print("\n--- Received POST request to /save-markers ---")
    try:
        data = request.get_json()
        tour_id = data.get('tourId')
        room_from = data.get('roomFrom')
        new_markers = data.get('markers')

        print(f"    [save_markers_endpoint] Received tourId: {tour_id}, roomFrom: {room_from}, markers count: {len(new_markers) if new_markers else 0}")

        if not tour_id or not room_from or not isinstance(new_markers, list):
            print("    [save_markers_endpoint] Error: Invalid data provided for saving markers.")
            return jsonify({'success': False, 'error': 'Invalid data provided for saving markers.'}), 400

        print(f"    [save_markers_endpoint] Deleting existing markers for tourId {tour_id}, roomFrom {room_from}.")
        delete_res = supabase.table(SUPABASE_MARKERS_TABLE).delete().eq("tour_id", tour_id).eq("from_room", room_from).execute()
        print(f"    [save_markers_endpoint] Deleted {len(delete_res.data)} existing markers.")

        if new_markers:
            markers_to_insert = []
            for marker in new_markers:
                marker_id = marker.get('id', str(uuid.uuid4()))
                markers_to_insert.append({
                    "id": marker_id,
                    "tour_id": tour_id,
                    "from_room": room_from,
                    "to_room": marker['linkTo'],
                    "position_x": marker['position_x'],
                    "position_y": marker['position_y']
                })
            print(f"    [save_markers_endpoint] Inserting {len(markers_to_insert)} new markers.")
            insert_res = supabase.table(SUPABASE_MARKERS_TABLE).insert(markers_to_insert).execute()
            if not insert_res.data:
                print(f"    [save_markers_endpoint] ❌ Failed to insert new markers. Error: {insert_res.error}")
                raise Exception(f"Failed to insert new markers: {insert_res.error}")
            print(f"    [save_markers_endpoint] ✅ Inserted {len(insert_res.data)} new markers.")

        print("--- Markers saved successfully. ---")
        return jsonify({'success': True, 'message': 'Markers saved successfully.'})
    except Exception as e:
        print(f"--- ❌ Error in /save-markers endpoint: {e} ---")
        return jsonify({'success': False, 'error': f"Server error saving markers: {str(e)}"}), 500

@app.route('/save-tooltips', methods=['POST'])
def save_tooltips_endpoint():
    print("\n--- Received POST request to /save-tooltips ---")
    try:
        data = request.get_json()
        tour_id = data.get('tourId')
        room_name = data.get('roomName')
        new_tooltips = data.get('tooltips')

        print(f"    [save_tooltips_endpoint] Received tourId: {tour_id}, roomName: {room_name}, tooltips count: {len(new_tooltips) if new_tooltips else 0}")

        if not tour_id or not room_name or not isinstance(new_tooltips, list):
            print("    [save_tooltips_endpoint] Error: Invalid data provided for saving tooltips.")
            return jsonify({'success': False, 'error': 'Invalid data provided for saving tooltips.'}), 400

        print(f"    [save_tooltips_endpoint] Deleting existing tooltips for tourId {tour_id}, roomName {room_name}.")
        delete_res = supabase.table(SUPABASE_TOOLTIPS_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()
        print(f"    [save_tooltips_endpoint] Deleted {len(delete_res.data)} existing tooltips.")

        if new_tooltips:
            tooltips_to_insert = []
            for tooltip in new_tooltips:
                tooltip_id = tooltip.get('id', str(uuid.uuid4()))
                tooltips_to_insert.append({
                    "id": tooltip_id,
                    "tour_id": tour_id,
                    "room_name": room_name,
                    "content": tooltip['content'],
                    "position_x": tooltip['position_x'],
                    "position_y": tooltip['position_y']
                })
            print(f"    [save_tooltips_endpoint] Inserting {len(tooltips_to_insert)} new tooltips.")
            insert_res = supabase.table(SUPABASE_TOOLTIPS_TABLE).insert(tooltips_to_insert).execute()
            if not insert_res.data:
                print(f"    [save_tooltips_endpoint] ❌ Failed to insert new tooltips. Error: {insert_res.error}")
                raise Exception(f"Failed to insert new tooltips: {insert_res.error}")
            print(f"    [save_tooltips_endpoint] ✅ Inserted {len(insert_res.data)} new tooltips.")

        print("--- Tooltips saved successfully. ---")
        return jsonify({'success': True, 'message': 'Tooltips saved successfully.'})
    except Exception as e:
        print(f"--- ❌ Error in /save-tooltips endpoint: {e} ---")
        return jsonify({'success': False, 'error': f"Server error saving tooltips: {str(e)}"}), 500

@app.route('/upload-audio', methods=['POST'])
def upload_audio_endpoint():
    print("\n--- Received POST request to /upload-audio ---")
    try:
        tour_id = request.form.get('tourId')
        room_name = request.form.get('roomName')
        audio_file = request.files.get('audio')

        print(f"    [upload_audio_endpoint] Received tourId: {tour_id}, roomName: {room_name}")

        if not tour_id or not room_name or not audio_file:
            print("    [upload_audio_endpoint] Error: Missing tour ID, room name, or audio file.")
            return jsonify({'success': False, 'error': 'Missing tour ID, room name, or audio file.'}), 400

        # Define Supabase Storage path for audio
        # Ensure room_name is URL-safe for the path
        supabase_audio_path = f"{tour_id}/{quote(room_name.replace(' ', '_'))}_audio.mp3"

        print(f"    [upload_audio_endpoint] ☁️ Uploading audio to Supabase Storage: {supabase_audio_path}")
        upload_result = supabase.storage.from_(SUPABASE_AUDIO_BUCKET_NAME).upload(
            file=audio_file.read(), # Read the file content
            path=supabase_audio_path,
            file_options={"content-type": "audio/mpeg", "upsert": "true"} # Upsert to overwrite if exists
        )

        if hasattr(upload_result, 'path') and upload_result.path:
            print(f"    [upload_audio_endpoint] ✅ Supabase Storage audio upload successful. Response: {upload_result}")
            public_url = supabase.storage.from_(SUPABASE_AUDIO_BUCKET_NAME).get_public_url(supabase_audio_path)
            if public_url:
                audio_url = public_url
                print(f"    [upload_audio_endpoint] ✅ Supabase Public Audio URL: {audio_url}")
            else:
                raise Exception("Failed to get public URL for audio from Supabase after upload.")
        else:
            print(f"    [upload_audio_endpoint] ❌ Supabase Storage audio upload failed. Unexpected response: {upload_result}")
            raise Exception(f"Supabase Storage audio upload failed: Unexpected response type or content. Raw response: {upload_result}")

        # Store audio URL in the Supabase database
        print(f"    [upload_audio_endpoint] Upserting audio URL to {SUPABASE_TOUR_AUDIO_TABLE} for room: {room_name}")
        db_response = supabase.table(SUPABASE_TOUR_AUDIO_TABLE).upsert({
            "tour_id": tour_id,
            "room_name": room_name,
            "audio_url": audio_url
        }, on_conflict="tour_id, room_name").execute() # Use on_conflict to update if exists

        if db_response.data:
            print(f"    [upload_audio_endpoint] ✅ Saved audio URL to Supabase DB for room: {room_name}. Response: {db_response.data}")
        else:
            print(f"    [upload_audio_endpoint] ❌ Failed to save audio URL to Supabase DB for room: {room_name}. Error: {db_response.error}")
            raise Exception(f"Failed to save audio URL for {room_name} to database: {db_response.error}")

        print("--- Audio uploaded and metadata saved successfully. ---")
        return jsonify({'success': True, 'message': 'Audio uploaded successfully!', 'audioUrl': audio_url}), 200

    except Exception as e:
        print(f"--- ❌ Error in /upload-audio endpoint: {e} ---")
        traceback.print_exc() # Print full traceback for debugging
        return jsonify({'success': False, 'error': f"Server error uploading audio: {str(e)}"}), 500

@app.route('/delete-audio', methods=['POST'])
def delete_audio_endpoint():
    print("\n--- Received POST request to /delete-audio ---")
    try:
        data = request.get_json()
        tour_id = data.get('tourId')
        room_name = data.get('roomName')

        if not tour_id or not room_name:
            return jsonify({'success': False, 'error': 'Missing tour ID or room name.'}), 400

        # Delete from Supabase Storage
        supabase_audio_path = f"{tour_id}/{quote(room_name.replace(' ', '_'))}_audio.mp3"
        try:
            supabase.storage.from_(SUPABASE_AUDIO_BUCKET_NAME).remove([supabase_audio_path])
            print(f"✅ Audio file '{supabase_audio_path}' deleted from Supabase Storage.")
        except Exception as e:
            print(f"⚠️ Could not delete audio file from Supabase Storage (might not exist): {e}")
            # Continue even if file deletion fails, as DB entry might still need to be removed

        # Delete from Supabase Database
        db_response = supabase.table(SUPABASE_TOUR_AUDIO_TABLE).delete().eq("tour_id", tour_id).eq("room_name", room_name).execute()

        if db_response.data:
            print(f"✅ Audio entry for room '{room_name}' deleted from Supabase DB.")
            return jsonify({'success': True, 'message': 'Audio removed successfully!'}), 200
        else:
            print(f"❌ Failed to delete audio entry from Supabase DB: {db_response.error}")
            return jsonify({'success': False, 'error': f"Failed to remove audio from database: {db_response.error}"}), 500

    except Exception as e:
        print(f"--- ❌ Error in /delete-audio endpoint: {e} ---")
        traceback.print_exc()
        return jsonify({'success': False, 'error': f"Server error deleting audio: {str(e)}"}), 500

@app.route('/update-start-room', methods=['POST'])
def update_start_room_endpoint():
    print("\n--- Received POST request to /update-start-room ---")
    try:
        data = request.get_json()
        tour_id = data.get('tourId')
        new_start_room = data.get('newStartRoom')

        print(f"    [update_start_room_endpoint] Received tourId: {tour_id}, newStartRoom: {new_start_room}")

        if not tour_id or not new_start_room:
            print("    [update_start_room_endpoint] Error: Missing tour ID or new start room.")
            return jsonify({'success': False, 'error': 'Missing tour ID or new start room.'}), 400

        print(f"    [update_start_room_endpoint] Updating start_room for tour '{tour_id}' to '{new_start_room}'.")
        response = supabase.table(SUPABASE_TOURS_TABLE).update({"start_room": new_start_room}).eq("tour_id", tour_id).execute()

        if response.data:
            print(f"    [update_start_room_endpoint] ✅ Start room updated successfully in {SUPABASE_TOURS_TABLE}. Response: {response.data}")
            return jsonify({'success': True, 'message': 'Start room updated successfully.'}), 200
        else:
            print(f"    [update_start_room_endpoint] ❌ Failed to update start room. Error: {response.error}")
            return jsonify({'success': False, 'error': f"Failed to update start room: {response.error}"}), 500

    except Exception as e:
        print(f"--- ❌ Error in /update-start-room endpoint: {e} ---")
        traceback.print_exc()
        return jsonify({'success': False, 'error': f"Server error updating start room: {str(e)}"}), 500


if __name__ == '__main__':
    print("--- Starting Flask Application ---")
    print(f"Upload Folder: {app.config['UPLOAD_FOLDER']}")
    print(f"Temp Output Folder: {app.config['TEMP_OUTPUT_FOLDER']}")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Supabase Image Bucket: {SUPABASE_BUCKET_NAME}")
    print(f"Supabase Audio Bucket: {SUPABASE_AUDIO_BUCKET_NAME}") # New: Log audio bucket
    print(f"Supabase Tours Table: {SUPABASE_TOURS_TABLE}")
    print(f"Supabase Audio Table: {SUPABASE_TOUR_AUDIO_TABLE}") # New: Log audio table
    print("--- Flask Application Ready ---")
    app.run(debug=True, host='0.0.0.0', port=5000)


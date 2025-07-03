import cv2
import numpy as np

def stitch_images(image_paths, output_path):
    """
    Stitches images together to create a panorama and attempts to remove black areas.

    Args:
        image_paths (list): List of paths to the images to stitch.
        output_path (str): Path to save the stitched panorama.

    Returns:
        tuple: (bool, numpy.ndarray)
            - The first element is a boolean indicating success (True) or failure (False).
            - The second element is the stitched image as a numpy.ndarray if successful, None otherwise.
    """
    images = [cv2.imread(path) for path in image_paths if path]

    if len(images) < 2:
        return False, None  # Need at least 2 images to stitch

    stitcher = cv2.Stitcher_create()
    status, stitched = stitcher.stitch(images)

    if status == cv2.Stitcher_OK:
        stitched_image = stitched
        # Attempt to remove black borders
        stitched_image = remove_black_borders(stitched_image)
        cv2.imwrite(output_path, stitched_image)
        return True, stitched_image
    else:
        print("Stitching failed with status code:", status)
        return False, None

def remove_black_borders(image):
    """
    Removes black borders from a stitched image.

    Args:
        image (numpy.ndarray): The stitched image.

    Returns:
        numpy.ndarray: The image with black borders removed, or the original image if no borders were found.
    """
    # 1. Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 2. Find the non-black regions
    _, thresh = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return image  # No non-black regions found

    # 3. Get the bounding rectangle of the non-black region
    x, y, w, h = cv2.boundingRect(contours[0])

    # 4. Crop the image to the bounding rectangle
    cropped_image = image[y:y+h, x:x+w]
    return cropped_image

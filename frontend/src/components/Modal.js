// src/components/Modal.js
import React from 'react';

const Modal = ({ message, onClose, onSignUp }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-3xl font-semibold text-center text-red-600 mb-6">
          Sign In Required
        </h2>
        <p className="text-center text-lg text-gray-600 mb-8">
          {message}
        </p>
        <div className="flex justify-center gap-6">
          <button
            onClick={onClose}
            className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg font-medium transition duration-200 transform hover:scale-105"
          >
            Close
          </button>

          <button
            onClick={onSignUp}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition duration-200 transform hover:scale-105"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
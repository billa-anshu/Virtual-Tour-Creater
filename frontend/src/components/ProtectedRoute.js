// src/components/ProtectedRoute.js
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { Navigate } from "react-router-dom";
import Modal from "./Modal";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showMessage, setShowMessage] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
                                  
      if (!currentUser) {
        setShowMessage(true);
        setTimeout(() => {
          setShouldRedirect(true);
        }, 2000); // Show message for 2s before redirect
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return null;
  if (shouldRedirect) return <Navigate to="/login" replace />;

  return (
    <>
      {showMessage && (
        <Modal
          message="Please sign in to access this page."
          onClose={() => setShowMessage(false)}
        />
      )}
      {user && children}
    </>
  );
}
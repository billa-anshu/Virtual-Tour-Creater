import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../Supabase"; // Assuming your Supabase client is initialized and exported here

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [alert, setAlert] = useState({ type: "", message: "" });
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setAlert({ type: "", message: "" });

    try {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setAlert({ type: "danger", message: error.message });
      } else {
        setAlert({ type: "success", message: "Account created successfully! Please check your email for verification." });
        // Optionally navigate to a success page or login after a delay
        setTimeout(() => navigate("/login"), 3000); // Redirect to login after successful signup
      }
    } catch (err) {
      console.error("Signup error:", err);
      setAlert({ type: "danger", message: "An unexpected error occurred during signup." });
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f9fa", // Light gray background
        fontFamily: "sans-serif", // Ensure font consistency
      }}
    >
      {/* Container for the signup form */}
      <div
        style={{
          backgroundColor: "#ffffff", // White background for the card
          borderRadius: "1rem",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)", // Clean shadow
          maxWidth: "400px",
          width: "100%",
          padding: "2.5rem",
          textAlign: "center",
          color: "#333", // Default text color
        }}
      >
        <h3
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "1.5rem",
            color: "#4f46e5", // Primary color for heading
          }}
        >
          Sign Up
        </h3>
        {alert.message && (
          <div
            style={{
              backgroundColor:
                alert.type === "danger"
                  ? "#f8d7da" // Light red for danger
                  : "#d4edda", // Light green for success
              color:
                alert.type === "danger"
                  ? "#721c24" // Dark red text
                  : "#155724", // Dark green text
              padding: "10px",
              borderRadius: "8px",
              marginBottom: "15px",
              fontSize: "0.9rem",
              border: `1px solid ${alert.type === "danger" ? "#f5c6cb" : "#c3e6cb"}`,
            }}
          >
            {alert.message}
          </div>
        )}
        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <div style={{ marginBottom: "10px", textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", fontWeight: "500" }}>Email address</label>
            <input
              type="email"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #ced4da",
                backgroundColor: "#f8f9fa", // Light input background
                color: "#333",
                boxSizing: "border-box",
                fontSize: "1rem",
              }}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
            />
          </div>
          <div style={{ marginBottom: "10px", textAlign: "left" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", fontWeight: "500" }}>Password</label>
            <div style={{ display: "flex", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                style={{
                  flexGrow: 1,
                  padding: "12px",
                  borderRadius: "8px 0 0 8px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#f8f9fa",
                  color: "#333",
                  boxSizing: "border-box",
                  fontSize: "1rem",
                  outline: "none",
                }}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                type="button"
                style={{
                  backgroundColor: "#e9ecef",
                  border: "1px solid #ced4da",
                  borderLeft: "none",
                  borderRadius: "0 8px 8px 0",
                  padding: "12px 15px",
                  color: "#495057",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "background-color 0.3s ease",
                  fontSize: "0.9rem",
                }}
                onClick={() => setShowPassword(!showPassword)}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#dee2e6"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#e9ecef"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            style={{
              display: "inline-block",
              padding: "0.75rem 2rem",
              backgroundColor: "#4f46e5",
              color: "white",
              fontWeight: "600",
              borderRadius: "9999px",
              textDecoration: "none",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.2)",
              transition: "background-color 0.3s ease, transform 0.2s ease",
              border: "none",
              cursor: "pointer",
              width: "100%",
              marginTop: "10px",
              fontSize: "1.1rem",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#3b33b0";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#4f46e5";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Create Account
          </button>
        </form>
        <p style={{ marginTop: "20px", fontSize: "0.9rem", color: "#6c757d" }}>
          Already have an account?{" "}
          <span
            style={{
              color: "#4f46e5",
              cursor: "pointer",
              fontWeight: "bold",
              textDecoration: "underline",
              transition: "color 0.2s ease",
            }}
            role="button"
            onClick={() => navigate("/login")}
            onMouseOver={(e) => e.currentTarget.style.color = "#3b33b0"}
            onMouseOut={(e) => e.currentTarget.style.color = "#4f46e5"}
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

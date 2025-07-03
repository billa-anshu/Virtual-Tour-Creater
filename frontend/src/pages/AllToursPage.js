import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../Supabase'; // ✅ Ensure correct import path

const AllToursPage = () => {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTours = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tour')
        .select('tour_id, tour_name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("❌ Error fetching tours:", error.message);
        setLoading(false);
        return;
      }

      setTours(data || []);
      setLoading(false);
    };

    fetchTours();
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>🌐 Explore All Virtual Tours</h1>
        <p style={styles.subtitle}>Select any tour to view its immersive 360° experience</p>

        {loading ? (
          <p style={styles.message}>Loading tours...</p>
        ) : tours.length === 0 ? (
          <p style={styles.message}>No tours found.</p>
        ) : (
          <div className="row g-4 justify-content-center">
            {tours.map((tour, index) => (
              <div key={tour.tour_id} className="col-md-6 col-lg-4">
                <div
                  className="card h-100 shadow-sm border-0"
                  style={styles.card}
                  onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  <div className="card-body text-center">
                    <h5 className="card-title text-primary fw-semibold">
                      {tour.tour_name || `Untitled Tour #${index + 1}`}
                    </h5>
                    <p className="text-muted mb-3">
                      <span className="badge bg-light text-dark">ID:</span>{' '}
                      <code>{tour.tour_id}</code>
                    </p>
                    <Link to={`/tour/${tour.tour_id}`} className="btn btn-outline-primary w-100">
                      ▶️ View Tour
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 🎨 Styling
const styles = {
  page: {
    backgroundColor: '#f8f9fb',
    minHeight: '100vh',
    padding: '60px 20px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
  },
  title: {
    textAlign: 'center',
    fontSize: '2.5rem',
    fontWeight: '700',
    marginBottom: '12px',
    color: '#2c3e50',
    textShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    fontSize: '1.125rem',
    marginBottom: '40px',
  },
  message: {
    textAlign: 'center',
    color: '#999',
    fontSize: '1.2rem',
  },
  card: {
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    borderRadius: '14px',
  },
};

export default AllToursPage;

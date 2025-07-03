// App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VirtualTourForm from "./pages/VirtualTourForm";
import TourEditorPage from "./pages/TourEditorPage";
import PanoramaViewer from "./pages/PanoramaViewer";
import AllToursPage from './pages/AllToursPage';


import Home from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import 'bootstrap/dist/css/bootstrap.min.css';



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create" element={<VirtualTourForm />} />
        <Route path="/editor/:tourId" element={<TourEditorPage />} />
        <Route path="/tour/:tourId" element={<PanoramaViewer />} />
        <Route path="/tours" element={<AllToursPage />} />

      </Routes>
    </Router>
  );
}
export default App;
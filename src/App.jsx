import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Groups from "./pages/Groups";
import GroupDetails from "./pages/GroupDetails";
import Expenses from "./pages/Expenses";
import Settlements from "./pages/Settlements";
import Balance from "./pages/Balance";
import Profile from "./pages/Profile";
import Charts from "./pages/Charts";
import PdfReport from "./pages/PdfReport";
import Layout from "./components/Layout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Authenticated Routes wrapped in Layout */}
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/groups" element={<Layout><Groups /></Layout>} />
        <Route path="/groups/:id" element={<Layout><GroupDetails /></Layout>} />
        <Route path="/expenses" element={<Layout><Expenses /></Layout>} />
        <Route path="/settlements" element={<Layout><Settlements /></Layout>} />
        <Route path="/balance" element={<Layout><Balance /></Layout>} />
        <Route path="/profile" element={<Layout><Profile /></Layout>} />
        <Route path="/charts" element={<Layout><Charts /></Layout>} />
        <Route path="/report" element={<Layout><PdfReport /></Layout>} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
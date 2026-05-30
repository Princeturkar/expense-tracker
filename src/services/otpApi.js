import axios from "axios";

const OTP_API = axios.create({
  baseURL: import.meta.env.VITE_NODE_API + "/api",
});

export default OTP_API;

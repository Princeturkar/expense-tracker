import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_JAVA_API + "/api",
});

export default API;

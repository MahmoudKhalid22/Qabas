import { API_URL } from "../utils/config";
import axios from "axios";

const api = axios.create({
  baseURL: API_URL,
});

export default api;

import axios from "axios";

const BASE = "http://localhost:3000";

export const api = {
  getTreasuries() {
    return axios.get(`${BASE}/treasuries`);
  },

  createTreasury(data) {
    return axios.post(`${BASE}/treasuries`, data);
  },

  getProposals(tid) {
    return axios.get(`${BASE}/treasuries/${tid}/proposals`);
  },

  createProposal(tid, data) {
    return axios.post(`${BASE}/treasuries/${tid}/proposals`, data);
  },

  deposit(tid, data) {
    return axios.post(`${BASE}/treasuries/${tid}/deposit`, data);
  },

  signProposal(pid, data) {
    return axios.post(`${BASE}/proposals/${pid}/sign`, data);
  },

  executeProposal(pid) {
    return axios.post(`${BASE}/proposals/${pid}/execute`);
  },
};

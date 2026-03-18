import { create } from 'zustand';

export const useQueueStore = create((set) => ({
  entryId: localStorage.getItem('qflow_entry_id') || null,
  tokenNumber: null,
  status: null,
  position: null,
  queueName: null,
  restaurantName: null,
  nowServing: null,
  estimatedWait: null,
  
  setEntry: (data) => {
    if (data.entry_id) localStorage.setItem('qflow_entry_id', data.entry_id);
    set({
      entryId: data.entry_id,
      tokenNumber: data.token_number,
      status: data.status || 'waiting',
      position: data.position,
      queueName: data.queue_name,
      restaurantName: data.restaurant_name,
      nowServing: data.now_serving,
      estimatedWait: data.estimated_wait_minutes
    });
  },

  updateStatus: (data) => set((state) => ({
    ...state,
    status: data.status || state.status,
    position: data.position ?? state.position,
    nowServing: data.now_serving ?? state.nowServing,
    estimatedWait: data.estimated_wait_minutes ?? state.estimatedWait
  })),

  clear: () => {
    localStorage.removeItem('qflow_entry_id');
    set({
      entryId: null, tokenNumber: null, status: null, position: null,
      queueName: null, restaurantName: null, nowServing: null, estimatedWait: null
    });
  }
}));

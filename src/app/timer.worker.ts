// timer.worker.ts
let intervalId: any;
self.onmessage = function(e) {
  if (e.data === 'start') {
    intervalId = setInterval(() => {
      self.postMessage('tick');
    }, 5000); // 5 seconds
  } else if (e.data === 'stop') {
    clearInterval(intervalId);
  }
};
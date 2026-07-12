import { openStore } from './db.js';
import { initCaptureView } from './capture.js';
import { initReviewView } from './review.js';

async function main() {
  const store = await openStore();

  if (!store.isPersistent) {
    document.querySelector('#persistence-warning').hidden = false;
  }

  const captureView = document.querySelector('#capture-view');
  const reviewView = document.querySelector('#review-view');
  const navCapture = document.querySelector('#nav-capture');
  const navReview = document.querySelector('#nav-review');

  initCaptureView(store, captureView);
  const review = await initReviewView(store, reviewView);

  function showCapture() {
    captureView.hidden = false;
    reviewView.hidden = true;
    navCapture.classList.add('active');
    navReview.classList.remove('active');
  }

  async function showReview() {
    await review.refresh();
    captureView.hidden = true;
    reviewView.hidden = false;
    navReview.classList.add('active');
    navCapture.classList.remove('active');
  }

  navCapture.addEventListener('click', showCapture);
  navReview.addEventListener('click', showReview);
  showCapture();

  setupServiceWorker();
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const toast = document.querySelector('#update-toast');
  const updateButton = document.querySelector('#update-button');
  let waitingWorker = null;
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  updateButton.addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage('skipWaiting');
  });

  navigator.serviceWorker.register('./service-worker.js').then((registration) => {
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      toast.hidden = false;
    }
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = newWorker;
          toast.hidden = false;
        }
      });
    });
  });
}

main();

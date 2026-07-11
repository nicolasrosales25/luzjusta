// =====================================================
// LuzJusta — Inicialización de Firebase
// =====================================================
// Credenciales del proyecto luzjusta en Firebase Console
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyBjZylnuAoEqhfOfWkDzeHHxA22bLIpdw8",
  authDomain: "luzjusta.firebaseapp.com",
  projectId: "luzjusta",
  storageBucket: "luzjusta.firebasestorage.app",
  messagingSenderId: "662472028725",
  appId: "1:662472028725:web:5f5853a9d37ad9bdc1777c"
};

// ---- Carga del SDK desde CDN (sin npm, sin bundler) ----
(function () {
  function cargarScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
  }

  cargarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', function () {
    cargarScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js', function () {
      firebase.initializeApp(firebaseConfig);
      window._db = firebase.firestore();
      console.log('[LuzJusta] Firebase conectado ✓');
      document.dispatchEvent(new Event('firebase-listo'));
    });
  });
})();

/** Devuelve la instancia de Firestore, o null si no está lista */
function getDB() {
  return window._db || null;
}

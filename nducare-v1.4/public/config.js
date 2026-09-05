// Runtime config (edit before deploying the frontend).

// 1) Backend URL. Leave '' when the Node server serves this frontend itself.
//    For Netlify (frontend) + separate backend, set it to your API origin:
//    window.NC_API = 'https://api.yourdomain.com';
window.NC_API = '';

// 2) TURN server — strongly recommended for video on Nigerian mobile networks.
//    Free tier: https://www.metered.ca/stun-turn
// window.NC_TURN = { urls: ['turn:a.relay.metered.ca:80', 'turn:a.relay.metered.ca:443?transport=tcp'], username: '...', credential: '...' };

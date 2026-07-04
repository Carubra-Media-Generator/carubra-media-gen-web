const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing supabase URL or KEY");
    return;
  }

  const res = await fetch(`${url}/rest/v1/videos?select=job_id,status,video_url,created_at&order=created_at.desc&limit=5`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });

  const data = await res.json();
  const targetVideo = data.find(v => v.status === 'completed' && !v.video_url);
  if (!targetVideo) {
    console.log("No video with completed status and null URL found");
    return;
  }
  
  const jobId = targetVideo.job_id;
  console.log(`Target jobId: ${jobId}`);
  
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    keyFilename: process.env.VERTEX_CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;
  
  const location = process.env.VERTEX_LOCATION || 'us-central1';
  
  const lroUrl = `https://${location}-aiplatform.googleapis.com/v1/${jobId}`;
  const lroRes = await fetch(lroUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } });
  
  if (!lroRes.ok) {
    console.log(`LRO Request failed: ${lroRes.status} ${lroRes.statusText}`);
    console.log(await lroRes.text());
    return;
  }
  
  const lroData = await lroRes.json();
  console.log("Vertex AI LRO Response:");
  console.dir(lroData, { depth: null });
}

run();

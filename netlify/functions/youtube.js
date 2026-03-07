exports.handler = async (event) => {
  const videoId = event.queryStringParameters?.id;

  if (!videoId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing video id' }),
    };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`
    );
    const data = await res.json();

    if (data.error) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    const item = data.items?.[0];
    if (!item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: '動画が見つかりませんでした' }),
      };
    }

    const s = item.snippet;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: s.title,
        date:  s.publishedAt?.slice(0, 10) ?? '',
        thumb: s.thumbnails?.medium?.url ?? s.thumbnails?.default?.url ?? '',
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};

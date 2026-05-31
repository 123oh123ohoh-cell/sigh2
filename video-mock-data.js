// This file is a placeholder for a real backend or database.
// In a real app, this would not be needed. Here we mock video info for demo.

const videos = [
  {
    id: 'eporner',
    url: "videohover/EPORNER.COM - [YSaDm6clsNs] JAPANESE JAV ASIAN UNCENSORED CUMSHOT BIG TITS MILF BIG ASS BLOWJOB ANAL (720).mp4",
    title: "EPORNER: JAV Uncensored Big Tits Milf",
    creator: "Eporner Model",
    likes: 9999,
    views: 8888888,
    badge: "4K",
    duration: "12:34",
    thumbnail: "girlfriend/girl1.jpg"
  },
  {
    id: 1,
    url: "videos/girlfriend1.mp4",
    title: "Featured: Girl 1",
    creator: "Model Girl 1",
    likes: 1234,
    views: 1200000,
    badge: "HD",
    duration: "12:34",
    thumbnail: "girlfriend/girl1.jpg"
  },
  {
    id: 2,
    url: "videos/gf_girl1.mp4",
    title: "VIP: GF Girl 1",
    creator: "GF Girl 1",
    likes: 1100,
    views: 980000,
    badge: "4K",
    duration: "10:21",
    thumbnail: "gf/girl1.jpg"
  },
  {
    id: 3,
    url: "videos/raw1913348.mp4",
    title: "Exclusive: Raw 1913348",
    creator: "Raw Model",
    likes: 980,
    views: 870000,
    badge: "PRO",
    duration: "8:45",
    thumbnail: "raw/1913348.jpg"
  },
  {
    id: 4,
    url: "videos/hijab1.mp4",
    title: "Hijab Model POV",
    creator: "Hijab Star",
    likes: 2100,
    views: 1500000,
    badge: "HD",
    duration: "14:02",
    thumbnail: "hijab/hijab1.jpg"
  },
  {
    id: 5,
    url: "videos/diamonds.mp4",
    title: "Diamonds Collection",
    creator: "Diamond Queen",
    likes: 1750,
    views: 1120000,
    badge: "4K",
    duration: "9:58",
    thumbnail: "diamonds/diamonds1.jpg"
  },
  {
    id: 6,
    url: "videos/japan2.mp4",
    title: "Japan Model 2",
    creator: "Japan Beauty",
    likes: 890,
    views: 670000,
    badge: "HD",
    duration: "11:11",
    thumbnail: "japan/japan2.jpg"
  },
  {
    id: 7,
    url: "videos/classic1.mp4",
    title: "Classic Glam",
    creator: "Classic Star",
    likes: 1340,
    views: 920000,
    badge: "HD",
    duration: "13:37",
    thumbnail: "classic/classic1.jpg",
    url: "videos/classic1.mp4"
  },
  {
    id: 8,
    url: "videos/arts1.mp4",
    title: "Artistic Nude",
    creator: "Art Muse",
    likes: 1560,
    views: 1010000,
    badge: "PRO",
    duration: "7:59",
    thumbnail: "arts/arts1.jpg",
    url: "videos/arts1.mp4"
  },
  {
    id: 9,
    url: "videos/life-force.mp4",
    title: "Life Force Suck",
    creator: "Energy Queen",
    likes: 2000,
    views: 1800000,
    badge: "HD",
    duration: "15:20",
    thumbnail: "life-force/life1.jpg",
    url: "videos/life-force.mp4"
  },
  {
    id: 10,
    url: "videos/collections2.mp4",
    title: "Collections 2",
    creator: "Model Girl 2",
    likes: 990,
    views: 540000,
    badge: "4K",
    duration: "10:10",
    thumbnail: "collections/collections2.jpg",
    url: "videos/collections2.mp4"
  }
];

// Mock API endpoints for demo
if (window.location.pathname.endsWith('video-player.html')) {
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/videos/')) {
      const parts = input.split('/');
      if (parts[3] === 'recommended') {
        // Recommended videos: return all except current
        const currentId = parts[4];
        return Promise.resolve({
          json: () => Promise.resolve(videos.filter(v => String(v.id) !== String(currentId)))
        });
      } else {
        // Single video
        const id = parts[3];
        const vid = videos.find(v => String(v.id) === String(id));
        return Promise.resolve({
          json: () => Promise.resolve(vid || {})
        });
      }
    }
    // Comments: just return empty
    if (typeof input === 'string' && input.startsWith('/api/comments')) {
      return Promise.resolve({ json: () => Promise.resolve([]) });
    }
    // POST comments: no-op
    if (init && init.method === 'POST' && input === '/api/comments') {
      return Promise.resolve({ json: () => Promise.resolve({}) });
    }
    // Fallback to real fetch
    return window.originalFetch(input, init);
  };
}

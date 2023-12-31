const express = require("express");
const axios = require("axios");
require("dotenv").config(); // Load environment variables from a .env file
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 86400 }); // Cache TTL set to one day (in seconds)

const app = express();
const port = 3000;

app.use(express.json());

const client_id = process.env.MAL_CLIENT_ID;
const client_secret = process.env.MAL_CLIENT_SECRET;
const refresh_token = process.env.MAL_REFRESH_TOKEN;

const getAccessToken = async () => {
  const response = await fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",

    body: new URLSearchParams({
      client_id: client_id,
      client_secret: client_secret,
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    }),
  });

  return response.json();
};

app.get("/getUserWatchAnime", async (req, res) => {
  try {
    const { access_token } = await getAccessToken();
    const status = req.query.status;

    const cacheKey = `animeList_${status || "all"}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log("Data fetched from cache");
      res.json(cachedData);
      return;
    }

    const animeList = [];
    let nextPage =
      "https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status";

    if (status) {
      nextPage += `&status=${status}`;
    }

    const fetchAnimePage = async (pageUrl) => {
      const response = await axios.get(pageUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const { data, paging } = response.data;
      animeList.push(...data);

      return paging?.next;
    };

    const fetchAllAnimePages = async () => {
      const pages = [];

      while (nextPage) {
        pages.push(nextPage);
        nextPage = await fetchAnimePage(nextPage);
      }

      return pages;
    };

    const allPages = await fetchAllAnimePages();
    await Promise.all(allPages.map(fetchAnimePage));

    // Cache the data
    cache.set(cacheKey, animeList);

    res.json(animeList);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/getAnime/:id", async (req, res) => {
  try {
    const { access_token } = await getAccessToken();
    const id = req.params.id;

    const cacheKey = `anime_${id}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log(`Anime data for id ${id} fetched from cache`);
      res.json(cachedData);
      return;
    }

    const response = await axios.get(
      `https://api.myanimelist.net/v2/anime/${id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    // Cache the data
    cache.set(cacheKey, response.data);

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/getAnimeList", async (req, res) => {
  try {
    const { access_token } = await getAccessToken();
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

var map = L.map("map").setView([51.505, -0.09], 13);

async function getBusStops() {
  const url =
    "https://retro.umoiq.com/service/publicXMLFeed?command=routeList&a=unitrans";
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status}`);
    }

    const result = await response.text();
    console.log(result);
  } catch (error) {
    throw new Error(`${error}`);
  }
}

getBusStops();

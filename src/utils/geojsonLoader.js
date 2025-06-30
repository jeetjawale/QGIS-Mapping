// Loads and merges multiple GeoJSONs
export async function loadGeoJSONs(fileList) {
  const all = await Promise.all(
    fileList.map(file => fetch(file).then(res => res.json()))
  );
  // Merge all features into one FeatureCollection
  return {
    type: "FeatureCollection",
    features: all.flatMap(g => g.features || []),
  };
}

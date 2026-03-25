const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const storesFilePath = path.join(__dirname, "..", "data", "stores.json");
const previousStoresFilePath = path.join(__dirname, "..", "data", "previousStores.json");

const CITY_COORDINATES = {
  "Andhra Pradesh|Visakhapatnam": [17.6868, 83.2185],
  "Andhra Pradesh|Vijayawada": [16.5062, 80.648],
  "Andhra Pradesh|Guntur": [16.3067, 80.4365],
  "Andhra Pradesh|Nellore": [14.4426, 79.9865],
  "Andhra Pradesh|Tirupati": [13.6288, 79.4192],
  "Arunachal Pradesh|Itanagar": [27.0844, 93.6053],
  "Arunachal Pradesh|Naharlagun": [27.1047, 93.6952],
  "Arunachal Pradesh|Pasighat": [28.0661, 95.3268],
  "Arunachal Pradesh|Roing": [28.1554, 95.8544],
  "Arunachal Pradesh|Ziro": [27.5946, 93.8287],
  "Assam|Guwahati": [26.1445, 91.7362],
  "Assam|Dibrugarh": [27.4728, 94.912],
  "Assam|Silchar": [24.8333, 92.7789],
  "Assam|Jorhat": [26.7509, 94.2037],
  "Assam|Tezpur": [26.6528, 92.7926],
  "Bihar|Patna": [25.5941, 85.1376],
  "Bihar|Gaya": [24.7914, 85.0002],
  "Bihar|Bhagalpur": [25.2425, 86.9842],
  "Bihar|Muzaffarpur": [26.1209, 85.3647],
  "Bihar|Darbhanga": [26.1542, 85.8918],
  "Chhattisgarh|Raipur": [21.2514, 81.6296],
  "Chhattisgarh|Bhilai": [21.1938, 81.3509],
  "Chhattisgarh|Bilaspur": [22.0796, 82.1391],
  "Chhattisgarh|Korba": [22.3595, 82.7501],
  "Chhattisgarh|Raigarh": [21.8974, 83.395],
  "Goa|Panaji": [15.4909, 73.8278],
  "Goa|Margao": [15.2832, 73.9862],
  "Goa|Vasco": [15.3958, 73.8156],
  "Goa|Mapusa": [15.591, 73.8089],
  "Goa|Ponda": [15.4036, 74.0158],
  "Gujarat|Ahmedabad": [23.0225, 72.5714],
  "Gujarat|Surat": [21.1702, 72.8311],
  "Gujarat|Vadodara": [22.3072, 73.1812],
  "Gujarat|Rajkot": [22.3039, 70.8022],
  "Gujarat|Bhavnagar": [21.7645, 72.1519],
  "Haryana|Gurugram": [28.4595, 77.0266],
  "Haryana|Faridabad": [28.4089, 77.3178],
  "Haryana|Panipat": [29.3909, 76.9635],
  "Haryana|Ambala": [30.3752, 76.7821],
  "Haryana|Rohtak": [28.8955, 76.6066],
  "Himachal Pradesh|Shimla": [31.1048, 77.1734],
  "Himachal Pradesh|Mandi": [31.7084, 76.9314],
  "Himachal Pradesh|Solan": [30.9045, 77.0967],
  "Himachal Pradesh|Dharamshala": [32.219, 76.3234],
  "Himachal Pradesh|Kullu": [31.9579, 77.1095],
  "Jharkhand|Ranchi": [23.3441, 85.3096],
  "Jharkhand|Jamshedpur": [22.8046, 86.2029],
  "Jharkhand|Dhanbad": [23.7957, 86.4304],
  "Jharkhand|Bokaro": [23.6693, 86.1511],
  "Jharkhand|Hazaribagh": [23.9966, 85.3691],
  "Karnataka|Bengaluru": [12.9716, 77.5946],
  "Karnataka|Mysuru": [12.2958, 76.6394],
  "Karnataka|Mangaluru": [12.9141, 74.856],
  "Karnataka|Hubballi": [15.3647, 75.124],
  "Karnataka|Belagavi": [15.8497, 74.4977],
  "Kerala|Thiruvananthapuram": [8.5241, 76.9366],
  "Kerala|Kochi": [9.9312, 76.2673],
  "Kerala|Kozhikode": [11.2588, 75.7804],
  "Kerala|Thrissur": [10.5276, 76.2144],
  "Kerala|Kollam": [8.8932, 76.6141],
  "Madhya Pradesh|Bhopal": [23.2599, 77.4126],
  "Madhya Pradesh|Indore": [22.7196, 75.8577],
  "Madhya Pradesh|Gwalior": [26.2183, 78.1828],
  "Madhya Pradesh|Jabalpur": [23.1815, 79.9864],
  "Madhya Pradesh|Ujjain": [23.1765, 75.7885],
  "Maharashtra|Mumbai": [19.076, 72.8777],
  "Maharashtra|Pune": [18.5204, 73.8567],
  "Maharashtra|Nagpur": [21.1458, 79.0882],
  "Maharashtra|Nashik": [19.9975, 73.7898],
  "Maharashtra|Aurangabad": [19.8762, 75.3433],
  "Manipur|Imphal": [24.817, 93.9368],
  "Manipur|Churachandpur": [24.3333, 93.6833],
  "Manipur|Thoubal": [24.639, 94.0101],
  "Manipur|Bishnupur": [24.6281, 93.7638],
  "Manipur|Ukhrul": [25.1088, 94.3617],
  "Meghalaya|Shillong": [25.5788, 91.8933],
  "Meghalaya|Tura": [25.5138, 90.2177],
  "Meghalaya|Nongpoh": [25.9117, 91.8769],
  "Meghalaya|Jowai": [25.4526, 92.2081],
  "Meghalaya|Cherrapunji": [25.2702, 91.731],
  "Mizoram|Aizawl": [23.7271, 92.7176],
  "Mizoram|Lunglei": [22.8925, 92.7425],
  "Mizoram|Saiha": [22.4918, 92.9814],
  "Mizoram|Champhai": [23.4561, 93.3282],
  "Mizoram|Serchhip": [23.2988, 92.846],
  "Nagaland|Kohima": [25.6751, 94.1086],
  "Nagaland|Dimapur": [25.9091, 93.7266],
  "Nagaland|Mokokchung": [26.3228, 94.522],
  "Nagaland|Tuensang": [26.273, 94.8246],
  "Nagaland|Wokha": [26.097, 94.2605],
  "Odisha|Bhubaneswar": [20.2961, 85.8245],
  "Odisha|Cuttack": [20.4625, 85.8828],
  "Odisha|Rourkela": [22.2604, 84.8536],
  "Odisha|Berhampur": [19.3149, 84.7941],
  "Odisha|Sambalpur": [21.4669, 83.9812],
  "Punjab|Ludhiana": [30.9009, 75.8573],
  "Punjab|Amritsar": [31.634, 74.8723],
  "Punjab|Jalandhar": [31.326, 75.5762],
  "Punjab|Patiala": [30.3398, 76.3869],
  "Punjab|Bathinda": [30.211, 74.9455],
  "Rajasthan|Jaipur": [26.9124, 75.7873],
  "Rajasthan|Jodhpur": [26.2389, 73.0243],
  "Rajasthan|Udaipur": [24.5854, 73.7125],
  "Rajasthan|Kota": [25.2138, 75.8648],
  "Rajasthan|Ajmer": [26.4499, 74.6399],
  "Sikkim|Gangtok": [27.3389, 88.6065],
  "Sikkim|Namchi": [27.1652, 88.3639],
  "Sikkim|Mangan": [27.5167, 88.5333],
  "Sikkim|Gyalshing": [27.2917, 88.2571],
  "Sikkim|Rangpo": [27.1772, 88.5336],
  "Tamil Nadu|Chennai": [13.0827, 80.2707],
  "Tamil Nadu|Coimbatore": [11.0168, 76.9558],
  "Tamil Nadu|Madurai": [9.9252, 78.1198],
  "Tamil Nadu|Tiruchirappalli": [10.7905, 78.7047],
  "Tamil Nadu|Salem": [11.6643, 78.146],
  "Telangana|Hyderabad": [17.385, 78.4867],
  "Telangana|Warangal": [17.9689, 79.5941],
  "Telangana|Nizamabad": [18.6725, 78.0941],
  "Telangana|Karimnagar": [18.4386, 79.1288],
  "Telangana|Khammam": [17.2473, 80.1514],
  "Tripura|Agartala": [23.8315, 91.2868],
  "Tripura|Dharmanagar": [24.3667, 92.1667],
  "Tripura|Udaipur": [23.533, 91.481],
  "Tripura|Kailashahar": [24.3278, 92.0089],
  "Tripura|Ambassa": [23.936, 91.8544],
  "Uttar Pradesh|Lucknow": [26.8467, 80.9462],
  "Uttar Pradesh|Kanpur": [26.4499, 80.3319],
  "Uttar Pradesh|Varanasi": [25.3176, 82.9739],
  "Uttar Pradesh|Agra": [27.1767, 78.0081],
  "Uttar Pradesh|Meerut": [28.9845, 77.7064],
  "Uttarakhand|Dehradun": [30.3165, 78.0322],
  "Uttarakhand|Haridwar": [29.9457, 78.1642],
  "Uttarakhand|Roorkee": [29.8543, 77.888],
  "Uttarakhand|Haldwani": [29.2183, 79.512],
  "Uttarakhand|Rishikesh": [30.0869, 78.2676],
  "West Bengal|Kolkata": [22.5726, 88.3639],
  "West Bengal|Asansol": [23.6739, 86.9524],
  "West Bengal|Siliguri": [26.7271, 88.3953],
  "West Bengal|Durgapur": [23.5204, 87.3119],
  "West Bengal|Darjeeling": [27.036, 88.2627]
};

const LOCATION_COORDINATES = {
  "Telangana|Hyderabad|Madhapur": [17.4483, 78.3915]
};

function normalizeKey(...parts) {
  return parts.map((part) => (part || "").toString().trim()).join("|");
}

function getHashSeed(value) {
  const hash = crypto.createHash("sha1").update(value).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function addSmallOffset(latitude, longitude, seedSource) {
  const seed = getHashSeed(seedSource);
  const latitudeOffset = ((seed % 21) - 10) / 1000;
  const longitudeOffset = (((Math.floor(seed / 21)) % 21) - 10) / 1000;

  return {
    latitude: Number((latitude + latitudeOffset).toFixed(4)),
    longitude: Number((longitude + longitudeOffset).toFixed(4))
  };
}

function resolveCoordinates(store) {
  const locationKey = normalizeKey(store.state, store.city, store.location);
  const cityKey = normalizeKey(store.state, store.city);
  const baseCoordinates = LOCATION_COORDINATES[locationKey] || CITY_COORDINATES[cityKey];

  if (!baseCoordinates) {
    return {
      latitude: store.latitude,
      longitude: store.longitude
    };
  }

  return addSmallOffset(baseCoordinates[0], baseCoordinates[1], `${store.branchCode}|${store.name}`);
}

function applyCoordinates(store) {
  const coordinates = resolveCoordinates(store);

  return {
    ...store,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, payload) {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function run() {
  const hierarchy = await readJson(storesFilePath);
  const previousStores = await readJson(previousStoresFilePath);

  const updatedHierarchy = hierarchy.map((stateEntry) => ({
    ...stateEntry,
    cities: (stateEntry.cities || []).map((cityEntry) => ({
      ...cityEntry,
      stores: (cityEntry.stores || []).map((store) => applyCoordinates({
        ...store,
        state: store.state || stateEntry.state,
        city: store.city || cityEntry.city
      }))
    }))
  }));

  const updatedPreviousStores = previousStores.map((store) => applyCoordinates(store));

  await writeJson(storesFilePath, updatedHierarchy);
  await writeJson(previousStoresFilePath, updatedPreviousStores);

  console.log(`[coordinates] Updated ${updatedPreviousStores.length} imported LPG store coordinates.`);
}

run().catch((error) => {
  console.error("[coordinates] Failed to update imported coordinates:", error.message);
  process.exitCode = 1;
});

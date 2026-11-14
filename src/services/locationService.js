const LOCATION_STORAGE_KEY = "aumveda_current_location";

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        new Error(
          "Geolocation is not supported by this browser."
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(
              new Error(
                "Location permission was denied."
              )
            );
            break;

          case error.POSITION_UNAVAILABLE:
            reject(
              new Error(
                "Current location is unavailable."
              )
            );
            break;

          case error.TIMEOUT:
            reject(
              new Error(
                "Location request timed out."
              )
            );
            break;

          default:
            reject(
              new Error(
                "Unable to get your current location."
              )
            );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000,
      }
    );
  });
}

async function reverseGeocode(latitude, longitude) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(longitude)}&addressdetails=1`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      "Unable to find the address for your location."
    );
  }

  const data = await response.json();

  const address = data?.address || {};

  const addressLine1 = [
    address.house_number,
    address.road ||
      address.residential ||
      address.pedestrian ||
      address.street,
  ]
    .filter(Boolean)
    .join(" ");

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    "";
  const addressLine2 = [
    address.neighbourhood ||
      address.suburb ||
      address.quarter ||
      address.city_district,
    address.state_district,
  ]
    .filter((value) => value && value !== city)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(", ");
  const state = address.state || "";
  const postalCode = address.postcode || "";
  const country = address.country || "";
  const formattedAddress = [
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    address:
      formattedAddress ||
      data?.display_name ||
      "Address unavailable",
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  };
}

export async function getCurrentLocation() {
  const position = await getCurrentPosition();

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  const addressDetails = await reverseGeocode(
    latitude,
    longitude
  );

  const location = {
    latitude,
    longitude,
    ...addressDetails,
  };

  localStorage.setItem(
    LOCATION_STORAGE_KEY,
    JSON.stringify(location)
  );

  return location;
}

export function getSavedCurrentLocation() {
  try {
    const saved = localStorage.getItem(
      LOCATION_STORAGE_KEY
    );

    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function clearSavedCurrentLocation() {
  localStorage.removeItem(
    LOCATION_STORAGE_KEY
  );
}
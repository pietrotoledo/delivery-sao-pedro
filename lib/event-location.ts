export const eventLocation = {
  name: "Evidence Class Club",
  address: "R. Pfa. Eudesia Vieira, 159 - Estados, João Pessoa - PB, 58030-390",
};

export const eventLocationMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${eventLocation.name}, ${eventLocation.address}`)}`;

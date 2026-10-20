export const eventLocation = {
  name: "Casa Branca de Esquina",
  address: "Rua Francisco Claudino Pereira, 885 - Manaíra, João Pessoa - PB, 58038-431",
};

export const eventLocationMapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: eventLocation.address })}`;

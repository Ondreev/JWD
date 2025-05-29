const products = [
  {
    id: 1,
    name: "Картофель",
    price: 30,
    image: "potato.png"
  },
  {
    id: 2,
    name: "Морковь",
    price: 25,
    image: "carrot.png"
  },
  {
    id: 3,
    name: "Лук",
    price: 20,
    image: "onion.png"
  }
];

export default function handler(req, res) {
  res.status(200).json(products);
}

import { Player } from "@/lib/types";

/**
 * Demo roster of fictional players. The app ships with this so the live demo
 * works instantly; real groups import their own CSV, which stays in the
 * browser (localStorage) and never reaches a server or this repo.
 */
export const DEMO_ROSTER: Player[] = [
  { id: "Sanjay", name: "Sanjay", primary: "GK", secondary: "GK", skill: 3, running: 2, control: false, ageBand: "36-40" },
  { id: "Omar", name: "Omar", primary: "GK", secondary: "Full-back", skill: 2, running: 3, control: false, ageBand: "21-25" },
  { id: "Vikram", name: "Vikram", primary: "Defence", secondary: "Defence", skill: 5, running: 3, control: false, ageBand: "41-45" },
  { id: "Dev", name: "Dev", primary: "Defence", secondary: "Full-back", skill: 4, running: 3, control: true, ageBand: "31-35" },
  { id: "Harsh", name: "Harsh", primary: "Defence", secondary: "Midfield", skill: 3, running: 2, control: false, ageBand: "26-30" },
  { id: "Ritvik", name: "Ritvik", primary: "Defence", secondary: "Defence", skill: 3, running: 3, control: false, ageBand: "21-25" },
  { id: "Kabir", name: "Kabir", primary: "Full-back", secondary: "Winger", skill: 3, running: 4, control: false, ageBand: "26-30" },
  { id: "Sameer", name: "Sameer", primary: "Full-back", secondary: "Full-back", skill: 3, running: 2, control: false, ageBand: "46-50" },
  { id: "Zaid", name: "Zaid", primary: "Full-back", secondary: "Full-back", skill: 2, running: 3, control: false, ageBand: "21-25" },
  { id: "Manav", name: "Manav", primary: "Full-back", secondary: "Winger", skill: 3, running: 4, control: false, ageBand: "15-20" },
  { id: "Tejas", name: "Tejas", primary: "Full-back", secondary: "Full-back", skill: 2, running: 2, control: false, ageBand: "31-35" },
  { id: "Arjun", name: "Arjun", primary: "Midfield", secondary: "Midfield", skill: 5, running: 2, control: true, ageBand: "41-45" },
  { id: "Rohan", name: "Rohan", primary: "Midfield", secondary: "Defence", skill: 4, running: 4, control: true, ageBand: "26-30" },
  { id: "Nikhil", name: "Nikhil", primary: "Midfield", secondary: "Midfield", skill: 3, running: 2, control: false, ageBand: "46-50" },
  { id: "Pranav", name: "Pranav", primary: "Midfield", secondary: "Winger", skill: 4, running: 3, control: true, ageBand: "31-35" },
  { id: "Ishan", name: "Ishan", primary: "Winger", secondary: "Winger", skill: 5, running: 5, control: false, ageBand: "15-20" },
  { id: "Farhan", name: "Farhan", primary: "Winger", secondary: "Winger", skill: 4, running: 4, control: false, ageBand: "21-25" },
  { id: "Jay", name: "Jay", primary: "Winger", secondary: "Midfield", skill: 3, running: 3, control: false, ageBand: "26-30" },
  { id: "Aman", name: "Aman", primary: "Winger", secondary: "Winger", skill: 2, running: 4, control: false, ageBand: "15-20" },
  { id: "Aditya", name: "Aditya", primary: "Striker", secondary: "Striker", skill: 4, running: 3, control: false, ageBand: "41-45" },
  { id: "Rahul", name: "Rahul", primary: "Striker", secondary: "Midfield", skill: 4, running: 2, control: false, ageBand: "31-35" },
  { id: "Karan", name: "Karan", primary: "Striker", secondary: "Winger", skill: 3, running: 3, control: false, ageBand: "46-50" },
];

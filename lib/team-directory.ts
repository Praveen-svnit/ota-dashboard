export interface TeamMemberDirectoryEntry {
  id: string;
  name: string;
  teamLead: string;
  role: string;
  otas: string[];
  priority?: "P1" | "P2" | "P3";
}

const PROPOSED_TEAM_DIRECTORY: TeamMemberDirectoryEntry[] = [
  { id: "member-gourav", name: "Gourav", teamLead: "Gourav", role: "Team Lead", otas: ["Agoda", "Yatra", "Akbar Travels", "EaseMyTrip", "Booking.com"] },
  { id: "member-aman", name: "Aman", teamLead: "Gourav", role: "OTA Owner", otas: ["Agoda"], priority: "P1" },
  { id: "member-ajeet", name: "Ajeet", teamLead: "Gourav", role: "OTA Owner", otas: ["Yatra"], priority: "P1" },
  { id: "member-joti", name: "Joti", teamLead: "Gourav", role: "OTA Owner", otas: ["Akbar Travels"], priority: "P1" },
  { id: "member-vipul", name: "Vipul", teamLead: "Gourav", role: "OTA Owner", otas: ["EaseMyTrip"], priority: "P1" },
  { id: "member-gaurav-pandey", name: "Gaurav Pandey", teamLead: "Gourav", role: "OTA Owner", otas: ["Booking.com"], priority: "P1" },
  { id: "member-sajjak", name: "Sajjak", teamLead: "Gourav", role: "BDC Content", otas: [], priority: "P2" },

  { id: "member-abhijeet", name: "Abhijeet", teamLead: "Abhijeet", role: "Team Lead", otas: ["GoMMT", "Expedia", "Indigo", "Cleartrip", "Ixigo"] },
  { id: "member-rudra", name: "Rudra", teamLead: "Abhijeet", role: "OTA Owner", otas: ["GoMMT"], priority: "P1" },
  { id: "member-mohit", name: "Mohit", teamLead: "Abhijeet", role: "OTA Owner", otas: ["Expedia"], priority: "P1" },
  { id: "member-abhishek", name: "Abhishek", teamLead: "Abhijeet", role: "OTA Owner", otas: ["Indigo"], priority: "P2" },
  { id: "member-umesh", name: "Umesh", teamLead: "Abhijeet", role: "Ria Travels", otas: [], priority: "P2" },
  { id: "member-jyoti", name: "Jyoti", teamLead: "Abhijeet", role: "Sub-TL", otas: ["Cleartrip", "Ixigo"], priority: "P1" },
  { id: "member-karan", name: "Karan", teamLead: "Abhijeet", role: "OTA Owner", otas: ["Cleartrip"], priority: "P3" },
  { id: "member-shrishti", name: "Shrishti", teamLead: "Abhijeet", role: "OTA Owner", otas: ["Ixigo"], priority: "P3" },
  { id: "member-vishal", name: "Vishal", teamLead: "Abhijeet", role: "FH Listing", otas: [], priority: "P1" },
  { id: "member-ajay-dhama", name: "Ajay Dhama", teamLead: "Abhijeet", role: "FH Images and GMB Images", otas: [], priority: "P1" },
  { id: "member-yash", name: "Yash", teamLead: "Abhijeet", role: "OTA RLD", otas: [], priority: "P1" },
  { id: "member-gunjan", name: "Gunjan", teamLead: "Abhijeet", role: "OTA Images", otas: [], priority: "P2" },
  { id: "member-vanshika", name: "Vanshika", teamLead: "Abhijeet", role: "OTA Images", otas: [], priority: "P1" },
];

export function getTeamDirectory() {
  return PROPOSED_TEAM_DIRECTORY;
}

export function findTeamMemberByName(name: string | null | undefined) {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  return (
    PROPOSED_TEAM_DIRECTORY.find((member) => member.name.toLowerCase() === normalized) ??
    PROPOSED_TEAM_DIRECTORY.find((member) => member.name.toLowerCase().includes(normalized) || normalized.includes(member.name.toLowerCase())) ??
    null
  );
}

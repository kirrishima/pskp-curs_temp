If you are implementing API endpoints that return data from database tables, ensure that all fields of type Decimal are explicitly serialized to numeric values before sending the response. By default, Prisma serializes Decimal as strings, so you must convert them to numbers to maintain correct data types in the API output.

Service model – icon / iconUrl: use getFeatureIcon from client/src/components/RoomCard.tsx for rendering. iconUrl has priority as a custom image, otherwise icon must be a valid lucide-react icon name; fallback is handled automatically.

If you made any changes in the source code - advice git commit message
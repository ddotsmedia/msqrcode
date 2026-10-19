# Milestones customer app (React Native / Expo)

Native customer app. Uses the same live API as coffeesales.ae.

- Run: `pnpm --filter @msq/customer-app start` then scan the QR code with Expo Go.
- Build for stores: `npx eas build -p android` and `npx eas build -p ios` (needs an Expo account; set up EAS before the first store build).
- Screens: Menu, Offers, Branches, Rewards (card linking). Ordering, push and scanning are the next steps.

import { Stack } from 'expo-router';

export default function ShopLayout() {
  return (
    <Stack>
      <Stack.Screen name="edit" options={{ title: 'Shop Info' }} />
    </Stack>
  );
}

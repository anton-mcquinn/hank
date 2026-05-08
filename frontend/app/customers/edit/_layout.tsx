// frontend/app/customers/edit/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function CustomerEditLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}

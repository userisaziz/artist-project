import { useState } from 'react';
import { AppTextField, View } from '@art-circle/atelier-mobile';

export function Empty() {
  const [name, setName] = useState('');
  return (
    <View style={{ width: 340 }}>
      <AppTextField label="Full name" value={name} onChangeText={setName} placeholder="Ananya Rao" autoCapitalize="words" />
    </View>
  );
}

export function Filled() {
  const [email, setEmail] = useState('ananya.rao@gmail.com');
  return (
    <View style={{ width: 340 }}>
      <AppTextField label="Email (optional)" value={email} onChangeText={setEmail} placeholder="name@email.com" keyboardType="email-address" />
    </View>
  );
}

export function WithError() {
  const [email, setEmail] = useState('meera@');
  return (
    <View style={{ width: 340 }}>
      <AppTextField label="Email (optional)" value={email} onChangeText={setEmail} error="Enter a valid email, or leave it empty." />
    </View>
  );
}

/** @jsxImportSource nativewind */
'use client';

import { TAGLINE } from '@cairn/core';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';

export interface AuthFormValues {
  name: string;
  email: string;
  password: string;
}

export interface AuthFormProps {
  mode: 'sign-in' | 'sign-up';
  /** Resolve to an error message to show it, or to nothing on success. */
  onSubmit: (values: AuthFormValues) => Promise<string | undefined>;
  /** The "Create an account" / "Sign in" link at the bottom. */
  onSwitchMode: () => void;
}

/** Sign-in and sign-up form, shared by web and mobile. The app decides what submit does. */
export function AuthForm({ mode, onSubmit, onSwitchMode }: AuthFormProps) {
  const [values, setValues] = useState<AuthFormValues>({ name: '', email: '', password: '' });
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  const field = (key: keyof AuthFormValues) => (text: string) =>
    setValues((current) => ({ ...current, [key]: text }));

  async function submit() {
    setSubmitting(true);
    setError(undefined);
    try {
      const message = await onSubmit({ ...values, email: values.email.trim() });
      if (message) setError(message);
    } catch {
      setError('Something went wrong. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="w-full max-w-sm gap-5">
      <View className="gap-1">
        <Text className="text-3xl font-bold text-stone-900">
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text className="text-base text-stone-600">{TAGLINE}</Text>
      </View>

      {isSignUp && (
        <TextField
          label="Name"
          value={values.name}
          onChangeText={field('name')}
          autoComplete="name"
          textContentType="name"
        />
      )}
      <TextField
        label="Email"
        value={values.email}
        onChangeText={field('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={values.password}
        onChangeText={field('password')}
        placeholder={isSignUp ? 'At least 8 characters' : undefined}
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        textContentType={isSignUp ? 'newPassword' : 'password'}
        onSubmitEditing={submit}
      />

      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}

      <Button title={isSignUp ? 'Sign up' : 'Sign in'} onPress={submit} loading={submitting} />

      <Pressable accessibilityRole="link" onPress={onSwitchMode}>
        <Text className="text-center text-sm text-stone-600">
          {isSignUp ? 'Already have an account? ' : 'New to Cairn? '}
          <Text className="font-semibold text-moss-700">
            {isSignUp ? 'Sign in' : 'Create an account'}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

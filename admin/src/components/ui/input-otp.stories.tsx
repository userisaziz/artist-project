import type { Meta, StoryObj } from "@storybook/react";

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "./input-otp";

const meta = {
  title: "Components/UI/InputOTP",
  component: InputOTP,
  tags: ["autodocs"],
} satisfies Meta;

export default meta;

type Story = StoryObj;

const OTP_LENGTH = 6;

function OtpSlots() {
  return (
    <>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <InputOTP maxLength={OTP_LENGTH}>
      <OtpSlots />
    </InputOTP>
  ),
};

export const Filled: Story = {
  render: () => (
    <InputOTP maxLength={OTP_LENGTH} defaultValue="482913">
      <OtpSlots />
    </InputOTP>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputOTP maxLength={OTP_LENGTH} disabled>
      <OtpSlots />
    </InputOTP>
  ),
};

import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta = {
  title: "Components/UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    placeholder: "Search artists",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { defaultValue: "Priya Sharma" },
};

export const Invalid: Story = {
  args: { defaultValue: "not-an-email", "aria-invalid": true },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Locked value" },
};

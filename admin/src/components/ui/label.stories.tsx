import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "Components/UI/Label",
  component: Label,
  tags: ["autodocs"],
  args: {
    children: "Display name",
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInput: Story = {
  render: (args) => (
    <div className="grid w-72 gap-2">
      <Label {...args} htmlFor="display-name" />
      <Input id="display-name" placeholder="Priya Sharma" />
    </div>
  ),
};

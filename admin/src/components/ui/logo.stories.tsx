import type { Meta, StoryObj } from "@storybook/react";

import { Logo } from "./logo";

const meta = {
  title: "Components/UI/Logo",
  component: Logo,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["md", "lg"] },
    tone: { control: "select", options: ["default", "inverse"] },
  },
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AdminRail: Story = { args: { size: "md", suffix: "admin" } };

export const OnPhoto: Story = {
  args: { size: "lg", tone: "inverse" },
  render: (args) => (
    <div className="bg-plum-deep p-6">
      <Logo {...args} />
    </div>
  ),
};

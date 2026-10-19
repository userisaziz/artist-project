import type { Meta, StoryObj } from "@storybook/react";

import { Separator } from "./separator";

const meta = {
  title: "Components/UI/Separator",
  component: Separator,
  tags: ["autodocs"],
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-72 text-sm">
      <p>Booking details</p>
      <Separator {...args} className="my-3" />
      <p className="text-muted-foreground">Payment handled offline</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: (args) => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span>Artists</span>
      <Separator {...args} orientation="vertical" />
      <span>Bookings</span>
      <Separator {...args} orientation="vertical" />
      <span>Reviews</span>
    </div>
  ),
};

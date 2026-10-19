import type { Meta, StoryObj } from "@storybook/react";

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "./avatar";

const meta = {
  title: "Components/UI/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>PS</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Avatar {...args} size="sm">
        <AvatarFallback>PS</AvatarFallback>
      </Avatar>
      <Avatar {...args} size="default">
        <AvatarFallback>PS</AvatarFallback>
      </Avatar>
      <Avatar {...args} size="lg">
        <AvatarFallback>PS</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithBadge: Story = {
  render: (args) => (
    <Avatar {...args} size="lg">
      <AvatarFallback>RK</AvatarFallback>
      <AvatarBadge />
    </Avatar>
  ),
};

export const Group: Story = {
  render: (args) => (
    <AvatarGroup>
      <Avatar {...args}>
        <AvatarFallback>PS</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>RK</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>AM</AvatarFallback>
      </Avatar>
      <AvatarGroupCount>+5</AvatarGroupCount>
    </AvatarGroup>
  ),
};

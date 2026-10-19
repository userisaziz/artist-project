import type { Meta, StoryObj } from "@storybook/react";
import { Ellipsis } from "lucide-react";

import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta = {
  title: "Components/UI/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  args: {
    defaultOpen: true,
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RowActions: Story = {
  render: (args) => (
    <div className="flex h-64 justify-end p-4">
      <DropdownMenu {...args}>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Add subcategory</DropdownMenuItem>
          <DropdownMenuItem disabled>Move to draft</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

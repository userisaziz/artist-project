import type { Meta, StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Demo({ variant }: { variant: "default" | "line" | "segment" }) {
  return (
    <Tabs defaultValue="id">
      <TabsList variant={variant}>
        <TabsTrigger value="id">Aadhaar</TabsTrigger>
        <TabsTrigger value="portfolio">Portfolio (24)</TabsTrigger>
        <TabsTrigger value="services">Services (6)</TabsTrigger>
      </TabsList>
      <TabsContent value="id">Aadhaar panel</TabsContent>
      <TabsContent value="portfolio">Portfolio panel</TabsContent>
      <TabsContent value="services">Services panel</TabsContent>
    </Tabs>
  );
}

const meta = {
  title: "Components/UI/Tabs",
  component: Demo,
  tags: ["autodocs"],
  args: { variant: "default" },
  argTypes: { variant: { control: "select", options: ["default", "line", "segment"] } },
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Segment: Story = { args: { variant: "segment" } };

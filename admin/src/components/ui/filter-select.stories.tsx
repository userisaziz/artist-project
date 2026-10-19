import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { FilterSelect } from "./filter-select";

const CITIES = [
  { value: "all", label: "All cities" },
  { value: "Bangalore", label: "Bangalore" },
  { value: "Mumbai", label: "Mumbai" },
];

function Demo() {
  const [city, setCity] = useState("all");
  return <FilterSelect label="City" value={city} options={CITIES} onValueChange={setCity} />;
}

const meta = {
  title: "Components/UI/FilterSelect",
  component: Demo,
  tags: ["autodocs"],
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

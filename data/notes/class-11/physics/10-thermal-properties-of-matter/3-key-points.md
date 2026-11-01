---
title: "Thermal Properties of Matter: Important Points and Traps"
type: key_points
chapter: c11.physics.thermal-properties-of-matter
order: 3
---

## Temperature scales

:::trap
A temperature **difference** converts differently from a temperature **reading**. A rise of 10 °C is a rise of **10 K** and of **18 °F**. Do not add 273 or 32 to a difference.
:::

- Celsius and Fahrenheit read the same number at **−40°** ($-40$ °C $= -40$ °F).
- Fahrenheit and Kelvin read the same number at about **574.6** using $T = t_C + 273.15$ (exam extra). If a question takes 0 °C = 273 K, it comes out as **574.25**.
- Kelvin temperatures are never negative. 0 K is the lowest possible temperature.

:::trap
Use **kelvin** in $PV = \mu RT$, in $\alpha_V = 1/T$ for a gas, and in Stefan's and Wien's laws. Using °C there gives wrong answers. Only temperature **differences** (as in $ms\Delta T$ or $KA\Delta T/L$) can stay in °C.
:::

:::remember
- The triple point of water is fixed at exactly **273.16 K**, and $T = t_C + 273.15$ is exact by choice. So the ice point and steam point are very close to, but not exactly, 0 °C and 100 °C.
- The triple-point pressure of water is about **611 Pa** (0.006 atm). NCERT prints $6.11 \times 10^{-3}$ Pa in its Triple Point box; the accepted value is 611.657 Pa $\approx 6.11 \times 10^{2}$ Pa.
:::

## Thermal expansion

:::trap
A **hole** in a plate **gets bigger** when the plate is heated, exactly as if it were made of the plate's material. The same goes for the inside of a ring or the cavity of a hollow sphere.
:::

- $\alpha_l : \alpha_A : \alpha_V = 1 : 2 : 3$ for an isotropic solid.
- Thermal stress $Y\alpha_l\Delta T$ does **not** depend on the length or the area. The **force** $YA\alpha_l\Delta T$ depends on the area.
- Heating a body changes its density: $\Delta\rho/\rho \approx -\alpha_V\Delta T$. It does not change its mass.
- Gaps are left between rail lengths and in bridges so that expansion in summer does not cause thermal stress.
- (Exam extra) A **bimetallic strip** bends when heated, with the metal of larger $\alpha$ on the **outer** (convex) side.
- (Exam extra) A pendulum clock **loses** time in summer (longer pendulum, longer period) and **gains** in winter.

:::trap
Water is the exception. Between 0 °C and 4 °C it **contracts** on heating. Its density is **maximum at 4 °C**, not at 0 °C. Ice is less dense than water, so ice floats.
:::

:::tip
For an ideal gas at constant pressure, $\alpha_V = 1/T$. At 27 °C (300 K), $\alpha_V = 1/300$ K⁻¹ $\approx 3.3 \times 10^{-3}$ K⁻¹. That is about 50 to 100 times more than for metals (NCERT Table 10.2), and about 3 times more than even ethanol, the liquid in that table that expands most.
:::

## Heat and calorimetry

- Heat capacity $S$ belongs to a **body** (it depends on its mass). Specific heat $s$ belongs to a **material**.
- Water has a very high specific heat. That is why it is a good coolant, and why coastal climates are mild.
- $C_p > C_v$ for a gas. With the pressure fixed, the gas expands and does work, so it needs more heat for the same rise (details in Chapter 11).
- Two bodies of equal heat capacity ($ms$) mixed together end at the **average** of their two temperatures (no change of state, no heat lost).

:::trap
$Q = ms\Delta T$ does **not** apply during melting or boiling, because the temperature does not change. Use $Q = mL$ for that part. Add up each stage separately: warm the ice, melt it, warm the water, boil it.
:::

:::trap
Mixing ice with warm water: **do not assume all the ice melts**. First compare the heat the water can give out by cooling to 0 °C with the heat needed to melt all the ice. If it is less, the mixture ends at **0 °C** with some ice left.
:::

- Steam at 100 °C burns more than water at 100 °C: each kg carries an extra $22.6 \times 10^5$ J of latent heat.
- If heat leaks to the surroundings in a specific-heat experiment, the measured specific heat of the hot metal comes out **smaller** than the true value.

## Change of state

- During any change of state, the temperature stays **constant** until the change is complete.
- **Regelation**: more pressure lowers the melting point of ice. (Exam extra: this is true for substances like water that **expand** on freezing. For most substances the melting point rises with pressure.)
- Boiling point **rises** with pressure (pressure cooker) and **falls** with lower pressure (hills).
- Dry ice and iodine **sublime**: they go straight from solid to vapour.

## Heat transfer

:::trap
In $H = KA\Delta T/L$, $H$ is a **rate** (watts), not a total amount of heat. Multiply by time for the heat in joules. The formula needs the **steady state**.
:::

- In the steady state, the same $H$ flows through every cross-section of a rod. In a series combination, the **same $H$** flows through each rod.
- For two equal rods in series, $K' = 2K_1K_2/(K_1 + K_2)$, the **harmonic mean**, not the simple average.
- Convection needs gravity (for natural convection) and a fluid. A hot bar under a running tap loses heat by **conduction** into the water, not by convection within it (NCERT).
- A brass tumbler feels colder than a wooden tray at the same temperature because brass **conducts** heat away from your hand faster.

:::trap
In radiation laws, the power goes as $T^4$ with $T$ in **kelvin**. Doubling the Celsius temperature does **not** make $H$ 16 times.
:::

- A good **absorber** is a good **emitter**. A body with a high reflectivity is a **poor** emitter. (Exam extra: Kirchhoff's law, $e = a$ at the same temperature.)
- Hotter body: $\lambda_m$ shorter (Wien), total power much larger ($T^4$, Stefan).

:::tip
**Red → yellow → white**: as an iron piece gets hotter, its colour climbs the spectrum, because $\lambda_m \propto 1/T$.
:::

## Newton's law of cooling

- The rate of cooling depends on the **excess** temperature $(T_2 - T_1)$, not on $T_2$ alone.
- Equal temperature drops take **longer** each time as the body cools, because the excess keeps getting smaller.
- The law holds only for **small** temperature differences.
- (Exam extra) Two bodies with the same surface (same $k$) at the same excess temperature but different $ms$ cool at different rates: $dT/dt \propto 1/(ms)$.

## NCERT lines to know

:::remember
- Heat is energy transferred because of a temperature difference.
- Water has its maximum density at 4 °C.
- The temperature stays constant during a change of state.
- Blackbody radiation curves depend only on temperature, not on size, shape or material.
- Radiation needs no medium and travels at the speed of light.
:::

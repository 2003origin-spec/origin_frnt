---
title: "Thermodynamics: Short Notes"
type: short_notes
chapter: c11.physics.thermodynamics
order: 2
---

## 1. What thermodynamics studies

Thermodynamics deals with heat, temperature and how heat changes into other forms of energy (mainly work). It is a **macroscopic** science: it uses quantities like pressure, volume, temperature and internal energy of the whole system, not the motion of single molecules.

- **System:** the part we study (for example, a gas in a cylinder with a piston).
- **Surroundings:** everything outside it that can exchange energy with it.

## 2. Thermal equilibrium and the zeroth law

- A system is in **equilibrium** when its macroscopic variables (P, V, T, mass, composition) do not change with time.
- Two systems in thermal contact are in **thermal equilibrium** with each other when, after contact, their variables stop changing (no net heat flows).
- An **adiabatic wall** lets no heat through. A **diathermic wall** (conducting) lets heat flow.
- Two systems joined by a diathermic wall reach thermal equilibrium when their **temperatures are equal**.

:::remember
**Zeroth law:** two systems that are each in thermal equilibrium with a third system are in thermal equilibrium with each other. This law gives us the idea of **temperature**: the quantity that is equal for systems in thermal equilibrium. It is why a thermometer works.
:::

## 3. Heat, internal energy and work

- **Internal energy $U$:** the sum of the kinetic and potential energies of the molecules, measured in the frame where the centre of mass of the system is at rest. The motion of the system as a whole is not counted. For an ideal gas, $U$ is only kinetic energy and depends **only on temperature**.
- **Heat:** energy that flows because of a **temperature difference**.
- **Work:** energy transferred by other means, for example by moving a piston.

| Quantity | State variable? | Meaning |
| --- | --- | --- |
| Internal energy $U$ | Yes | Depends only on the state |
| Heat $Q$ | No | Energy in transit (temperature difference) |
| Work $W$ | No | Energy in transit (other means) |

:::remember
A system does not "contain" heat or work. It contains internal energy. Heat and work are two **modes of energy transfer**, and their values depend on the path taken.
:::

## 4. First law of thermodynamics

$$\Delta Q = \Delta U + \Delta W$$

The heat given to a system is partly used to raise its internal energy and partly used to do work on the surroundings. It is the **law of conservation of energy** applied to a system that exchanges heat and work with its surroundings.

**Sign convention (NCERT Physics):** heat given **to** the system is positive; work done **by** the system is positive.

- $\Delta Q$ and $\Delta W$ depend on the path; $\Delta U = \Delta Q - \Delta W$ does **not**.
- For a gas at constant pressure, $\Delta W = P\Delta V$. In general, work is the area under the P–V curve.

:::trap
NCERT **Chemistry** (Thermodynamics, Class 11) writes $\Delta U = q + w$ with $w$ = work done **on** the system. In that book, expansion work is **negative**. In Physics it is **positive**. Same physics, opposite sign for $w$.
:::

## 5. Specific heat capacity

- **Heat capacity** $S = \Delta Q/\Delta T$ depends on the amount of substance.
- **Specific heat capacity** $s = \Delta Q/(m\Delta T)$ is per unit mass; it depends on the material and its temperature.
- **Molar specific heat** $C = \Delta Q/(\mu\Delta T)$ is per mole.
- Water has a very high specific heat, about 4186 J kg⁻¹ K⁻¹. That is why it is used as a coolant and in hot-water bags.

**Gases have two main molar specific heats:**
- $C_v$: heat at constant volume. No work is done, so all heat raises $U$.
- $C_p$: heat at constant pressure. The gas also expands and does work, so it needs **more** heat for the same $\Delta T$.

For one mole of an ideal gas: $C_p - C_v = R$ (Mayer's relation). The extra $R$ is the work $P\Delta V = R\Delta T$ done at constant pressure.

**Solids:** NCERT derives $C = 3R$ per mole here, using equipartition of energy (Chapter 12): each atom vibrates in 3 directions with average energy $k_BT$ each, so $U = 3RT$ per mole. ($\Delta V$ is tiny, so $\Delta Q \approx \Delta U$.) It agrees with experiment at ordinary temperatures, but carbon is an exception and it fails at low temperatures. (Other books call this the Dulong–Petit law.)

## 6. State variables and equation of state

- **State variables** describe an equilibrium state: $P$, $V$, $T$, $U$, mass, density. They do not depend on how the state was reached.
- **Equation of state** links them. For an ideal gas: $PV = \mu RT$.
- **Extensive** variables depend on the size of the system: $U$, $V$, total mass $M$.
- **Intensive** variables do not: $P$, $T$, density $\rho$.

:::tip
Quick test: imagine cutting the system into two equal halves. A variable that halves is **extensive**; one that stays the same is **intensive**.
:::

## 7. Thermodynamic processes

**Quasi-static process:** an infinitely slow process, so the system stays in thermal and mechanical equilibrium with its surroundings at every stage. Its pressure and temperature differ from those of the surroundings only by an infinitesimal amount. Its path can be drawn on a P–V graph. All the process formulas assume this.

Key results for an **ideal gas**:

| Process | Kept fixed | Key result |
| --- | --- | --- |
| Isothermal | $T$ | $\Delta U = 0$, $Q = W$ |
| Adiabatic | No heat flow | $Q = 0$, $W = -\Delta U$ |
| Isochoric | $V$ | $W = 0$, $Q = \Delta U$ |
| Isobaric | $P$ | $W = P\Delta V$ |
| Cyclic | Returns to start | $\Delta U = 0$, $Q = W$ |

- **Isothermal:** the gas is in a cylinder with conducting walls, in contact with a large reservoir, and changes slowly. On a P–V graph the curve is a hyperbola, $PV$ = constant. Expansion: heat is absorbed and all of it becomes work.
- **Adiabatic:** the cylinder is insulated, or the change is very fast so heat has no time to flow. For a quasi-static change of an ideal gas, $PV^\gamma$ = constant (NCERT quotes this without proof). When the gas expands, it does work from its own internal energy, so its **temperature falls**. When compressed, its temperature rises.
- **Isochoric:** heat only changes $U$ and $T$. On a P–V graph it is a **vertical** line.
- **Isobaric:** some heat raises $U$, the rest does work $P\Delta V$. It is a **horizontal** line on a P–V graph.
- **Cyclic:** the system comes back to its starting state, so $\Delta U = 0$. Net heat absorbed equals net work done, which equals the area of the loop.

:::remember
On a P–V graph the **adiabatic curve is steeper** than the isothermal curve through the same point (NCERT Fig. 11.8). Its slope is $\gamma$ times larger (exam extra). So for the same expansion from the same start, the isothermal process does **more work** than the adiabatic one.
:::

## 8. Second law of thermodynamics

The first law says energy is conserved. The second law says which energy changes are **possible**. It forbids processes that the first law would allow (a book on a table never jumps up by cooling the table). It limits the efficiency of a heat engine (never 1) and the coefficient of performance of a refrigerator (never infinite).

:::remember
- **Kelvin–Planck statement:** no process is possible whose sole result is the absorption of heat from a reservoir and the complete conversion of that heat into work. So no engine can have efficiency 1.
- **Clausius statement:** no process is possible whose sole result is the transfer of heat from a colder object to a hotter object. A refrigerator needs work to do it.
:::

The two statements are equivalent: if one were broken, the other would be broken too.

## 9. Reversible and irreversible processes

A process is **reversible** if it can be run backwards so that both the system and the surroundings return to their original states, with no other change anywhere in the universe.

A process is reversible only if it is **quasi-static** and there are **no dissipative effects** (friction, viscosity, and so on).

Real processes are **irreversible**, because:
- they are not quasi-static: free expansion of a gas, or heat flowing across a finite temperature difference;
- they involve friction or other dissipation.

Reversibility is an idealisation. It matters because a reversible engine gives the **highest possible efficiency**.

## 10. Carnot engine

A **Carnot engine** is a reversible engine working between two reservoirs, a hot one at $T_1$ and a cold one at $T_2$. Its cycle has four steps:

1. **Isothermal expansion** at $T_1$: the gas absorbs heat $Q_1$ from the hot reservoir.
2. **Adiabatic expansion**: temperature falls from $T_1$ to $T_2$.
3. **Isothermal compression** at $T_2$: the gas gives heat $Q_2$ to the cold reservoir.
4. **Adiabatic compression**: temperature rises from $T_2$ back to $T_1$.

Net work $W = Q_1 - Q_2$ and efficiency $\eta = 1 - \dfrac{T_2}{T_1}$. In a Carnot cycle $Q_1/Q_2 = T_1/T_2$ for any working substance, so NCERT uses this ratio to define a universal **thermodynamic temperature scale**.

:::remember
**Carnot's theorem:**
- No engine working between two given temperatures can be more efficient than a Carnot engine working between the same temperatures.
- The efficiency of a Carnot engine does not depend on the working substance.
:::

**Refrigerator:** NCERT says that running every step of the Carnot cycle backwards gives a **reversible refrigerator**. Work $W$ is done on the gas, which takes heat $Q_2$ from the cold reservoir and gives $Q_1 = Q_2 + W$ to the hot reservoir. A refrigerator is rated by its coefficient of performance $\alpha = Q_2/W$; this formula and the heat-pump formulas are exam extras (the separate heat-engine and refrigerator sections were removed from the current NCERT).

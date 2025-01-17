// Copyright (C) 2023 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Time, time} from '../../base/time';
import {exists} from '../../base/utils';
import {
  Plugin,
  PluginContext,
  PluginContextTrace,
  PluginDescriptor,
} from '../../public';

const SQL_STATS = `
with first as (select started as ts from sqlstats limit 1)
select
    round((max(ended - started, 0))/1e6) as runtime_ms,
    round((started - first.ts)/1e6) as t_start_ms,
    query
from sqlstats, first
order by started desc`;

const ALL_PROCESSES_QUERY = 'select name, pid from process order by name;';

const CPU_TIME_FOR_PROCESSES = `
select
  process.name,
  sum(dur)/1e9 as cpu_sec
from sched
join thread using(utid)
join process using(upid)
group by upid
order by cpu_sec desc
limit 100;`;

const CYCLES_PER_P_STATE_PER_CPU = `
select
  cpu,
  freq,
  dur,
  sum(dur * freq)/1e6 as mcycles
from (
  select
    cpu,
    value as freq,
    lead(ts) over (partition by cpu order by ts) - ts as dur
  from counter
  inner join cpu_counter_track on counter.track_id = cpu_counter_track.id
  where name = 'cpufreq'
) group by cpu, freq
order by mcycles desc limit 32;`;

const CPU_TIME_BY_CPU_BY_PROCESS = `
select
  process.name as process,
  thread.name as thread,
  cpu,
  sum(dur) / 1e9 as cpu_sec
from sched
inner join thread using(utid)
inner join process using(upid)
group by utid, cpu
order by cpu_sec desc
limit 30;`;

const HEAP_GRAPH_BYTES_PER_TYPE = `
select
  o.upid,
  o.graph_sample_ts,
  c.name,
  sum(o.self_size) as total_self_size
from heap_graph_object o join heap_graph_class c on o.type_id = c.id
group by
 o.upid,
 o.graph_sample_ts,
 c.name
order by total_self_size desc
limit 100;`;

const coreCommands: Plugin = {
  onActivate(_ctx: PluginContext) {},

  async onTraceLoad(ctx: PluginContextTrace): Promise<void> {
    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#ToggleLeftSidebar',
      name: 'Toggle left sidebar',
      callback: () => {
        if (ctx.sidebar.isVisible()) {
          ctx.sidebar.hide();
        } else {
          ctx.sidebar.show();
        }
      },
      defaultHotkey: '!Mod+B',
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#RunQueryAllProcesses',
      name: 'Run query: all processes',
      callback: () => {
        ctx.tabs.openQuery(ALL_PROCESSES_QUERY, 'All Processes');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#RunQueryCpuTimeByProcess',
      name: 'Run query: CPU time by process',
      callback: () => {
        ctx.tabs.openQuery(CPU_TIME_FOR_PROCESSES, 'CPU time by process');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#RunQueryCyclesByStateByCpu',
      name: 'Run query: cycles by p-state by CPU',
      callback: () => {
        ctx.tabs.openQuery(
          CYCLES_PER_P_STATE_PER_CPU, 'Cycles by p-state by CPU');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#RunQueryCyclesByCpuByProcess',
      name: 'Run query: CPU Time by CPU by process',
      callback: () => {
        ctx.tabs.openQuery(
          CPU_TIME_BY_CPU_BY_PROCESS, 'CPU Time by CPU by process');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#RunQueryHeapGraphBytesPerType',
      name: 'Run query: heap graph bytes per type',
      callback: () => {
        ctx.tabs.openQuery(
          HEAP_GRAPH_BYTES_PER_TYPE, 'Heap graph bytes per type');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#DebugSqlPerformance',
      name: 'Debug SQL performance',
      callback: () => {
        ctx.tabs.openQuery(SQL_STATS, 'Recent SQL queries');
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#PinFtraceTracks',
      name: 'Pin ftrace tracks',
      callback: () => {
        ctx.timeline.pinTracksByPredicate((tags) => {
          return !!tags.name?.startsWith('Ftrace Events Cpu ');
        });
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#UnpinAllTracks',
      name: 'Unpin all tracks',
      callback: () => {
        ctx.timeline.unpinTracksByPredicate((_) => {
          return true;
        });
      },
    });

    ctx.registerCommand({
      id: 'dev.perfetto.CoreCommands#PanToTimestamp',
      name: 'Pan To Timestamp',
      callback: (tsRaw: unknown) => {
        if (exists(tsRaw)) {
          if (typeof tsRaw !== 'bigint') {
            throw Error(`${tsRaw} is not a bigint`);
          }
          ctx.timeline.panToTimestamp(Time.fromRaw(tsRaw));
        } else {
          // No args passed, probably run from the command palette.
          const ts = promptForTimestamp('Enter a timestamp');
          if (exists(ts)) {
            ctx.timeline.panToTimestamp(Time.fromRaw(ts));
          }
        }
      },
    });
  },
};

function promptForTimestamp(message: string): time|undefined {
  const tsStr = window.prompt(message);
  if (tsStr !== null) {
    try {
      return Time.fromRaw(BigInt(tsStr));
    } catch {
      window.alert(`${tsStr} is not an integer`);
    }
  }
  return undefined;
}

export const plugin: PluginDescriptor = {
  pluginId: 'dev.perfetto.CoreCommands',
  plugin: coreCommands,
};

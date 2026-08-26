/* 明势 TrendSpect - 图表模块（ECharts 封装） */
(function () {
  "use strict";

  const D = window.DATA;
  const instances = {};

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function palette() {
    return {
      bg: "transparent",
      surface: cssVar("--surface"),
      border: cssVar("--border"),
      text: cssVar("--text"),
      text2: cssVar("--text-2"),
      text3: cssVar("--text-3"),
      accent: cssVar("--accent"),
      cyan: cssVar("--accent-2"),
      good: cssVar("--good"),
      warn: cssVar("--warn"),
      bad: cssVar("--bad")
    };
  }

  /* 毛玻璃霓虹 tooltip：深色半透明 + 青色光边 + 外发光 */
  function glassTooltip(p) {
    return {
      backgroundColor: "rgba(9, 15, 32, 0.92)",
      borderColor: hexA(p.cyan, 0.42),
      borderWidth: 1,
      padding: [10, 14],
      extraCssText: "box-shadow:0 0 20px rgba(54,191,250,0.26), 0 8px 30px rgba(0,0,0,0.5);border-radius:12px;backdrop-filter:blur(12px);",
      textStyle: { color: p.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace" },
      axisPointer: { lineStyle: { color: p.cyan, opacity: 0.55 } }
    };
  }

  function baseTooltip(p) {
    return Object.assign(glassTooltip(p), { trigger: "axis" });
  }

  /* 水平渐变光带：蓝 → 青 → 亮青 */
  function beamGradient(p, c2) {
    return {
      type: "linear", x: 0, y: 0, x2: 1, y2: 0,
      colorStops: [
        { offset: 0, color: p.accent },
        { offset: 0.55, color: p.cyan },
        { offset: 1, color: c2 || "#8ee7ff" }
      ]
    };
  }

  function baseAxis(p) {
    return {
      axisLine: { lineStyle: { color: hexA(p.cyan, 0.3) } },
      axisTick: { show: false },
      axisLabel: { color: p.text3, fontSize: 11, fontFamily: "JetBrains Mono, monospace" },
      splitLine: { lineStyle: { color: hexA(p.cyan, 0.1), type: "dashed" } }
    };
  }

  function fundOption(dim) {
    const p = palette();
    const series = D.fundFlow[dim];
    const dimLabel = { day: "日内", week: "近12周", month: "近12月" }[dim];
    return {
      animationDuration: 900,
      animationEasing: "cubicOut",
      tooltip: Object.assign(baseTooltip(p), { formatter: (params) => {
        const rows = params.map((it) => {
          const v = it.value > 0 ? "+" + it.value : it.value;
          return it.marker + " " + it.seriesName + "：<b>" + v + "</b> 亿元";
        }).join("<br>");
        return params[0].axisValue + " · " + dimLabel + "<br>" + rows;
      }}),
      legend: {
        top: 0,
        right: 8,
        itemGap: 18,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 3,
        textStyle: { color: p.text2, fontSize: 12 }
      },
      grid: { left: 12, right: 16, top: 46, bottom: 8, containLabel: true },
      xAxis: Object.assign(baseAxis(p), { type: "category", boundaryGap: false, data: series.x }),
      yAxis: Object.assign(baseAxis(p), {
        type: "value",
        axisLabel: Object.assign(baseAxis(p).axisLabel, { formatter: "{value}" }),
        splitNumber: 4
      }),
      dataZoom: [],
      series: [
        {
          name: "AI赛道主力净流入",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          showSymbol: false,
          data: series.ai,
          lineStyle: {
            width: 2.8,
            color: beamGradient(p),
            shadowBlur: 14,
            shadowColor: hexA(p.cyan, 0.85)
          },
          itemStyle: { color: p.cyan, shadowBlur: 12, shadowColor: hexA(p.cyan, 0.9) },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexA(p.cyan, 0.3) },
                { offset: 1, color: hexA(p.accent, 0.02) }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 3.4, shadowBlur: 22, shadowColor: hexA(p.cyan, 1) }
          }
        },
        {
          name: "科技板块基准",
          type: "line",
          smooth: true,
          symbol: "none",
          data: series.tech,
          lineStyle: {
            width: 1.8,
            color: hexA(p.cyan, 0.72),
            type: "dashed",
            shadowBlur: 8,
            shadowColor: hexA(p.cyan, 0.45)
          },
          itemStyle: { color: p.cyan }
        }
      ]
    };
  }

  function heatOption() {
    const p = palette();
    const data = [];
    D.heatmap.values.forEach((row, i) => {
      row.forEach((v, j) => {
        data.push([j, i, v]);
      });
    });
    return {
      animationDuration: 800,
      tooltip: {
        position: "top",
        backgroundColor: "rgba(9, 15, 32, 0.92)",
        borderColor: hexA(p.cyan, 0.42),
        borderWidth: 1,
        extraCssText: "box-shadow:0 0 20px rgba(54,191,250,0.26), 0 8px 30px rgba(0,0,0,0.5);border-radius:12px;backdrop-filter:blur(12px);",
        textStyle: { color: p.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace" },
        formatter: (params) => {
          const v = params.value[2];
          return D.heatmap.sectors[params.value[1]] + " · " + D.heatmap.days[params.value[0]] +
            "<br>涨跌幅：<b style='color:" + (v >= 0 ? p.bad : p.good) + "'>" + (v >= 0 ? "+" : "") + v + "%</b>";
        }
      },
      grid: { left: 10, right: 14, top: 12, bottom: 12, containLabel: true },
      xAxis: Object.assign(baseAxis(p), {
        type: "category",
        data: D.heatmap.days,
        splitArea: { show: false }
      }),
      yAxis: Object.assign(baseAxis(p), {
        type: "category",
        data: D.heatmap.sectors,
        axisLabel: { color: p.text2, fontSize: 11 },
        splitArea: { show: false },
        splitLine: { show: false }
      }),
      /* 红涨绿跌颜色映射（隐藏图例条，只保留颜色） */
      visualMap: {
        min: -3,
        max: 4,
        calculable: false,
        show: false,
        inRange: {
          color: [p.good, "#1f6e63", "#12233f", "#8a3f66", p.bad]
        }
      },
      series: [{
        type: "heatmap",
        data: data,
        label: {
          show: true,
          fontSize: 11,
          color: p.text,
          formatter: (params) => {
            const v = params.value[2];
            return (v > 0 ? "+" : "") + v;
          }
        },
        itemStyle: {
          borderWidth: 1,
          borderColor: p.surface,
          borderRadius: 4
        },
        emphasis: { itemStyle: { opacity: 0.9 } }
      }]
    };
  }

  function marketOption() {
    const p = palette();
    const items = D.markets.slice().reverse();
    return {
      animationDuration: 800,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "rgba(9, 15, 32, 0.92)",
        borderColor: hexA(p.cyan, 0.42),
        borderWidth: 1,
        extraCssText: "box-shadow:0 0 20px rgba(54,191,250,0.26), 0 8px 30px rgba(0,0,0,0.5);border-radius:12px;backdrop-filter:blur(12px);",
        textStyle: { color: p.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace" },
        formatter: (params) => {
          const v = params[0].value;
          const color = v >= 0 ? p.bad : p.good;
          return params[0].name + "<br>区间涨跌：<b style='color:" + color + "'>" + (v >= 0 ? "+" : "") + v + "%</b>";
        }
      },
      grid: { left: 10, right: 46, top: 8, bottom: 8, containLabel: true },
      xAxis: Object.assign(baseAxis(p), {
        type: "value",
        axisLabel: { color: p.text3, fontSize: 11, formatter: "{value}%" }
      }),
      yAxis: Object.assign(baseAxis(p), {
        type: "category",
        data: items.map((it) => it.name),
        axisLabel: { color: p.text2, fontSize: 12 },
        splitLine: { show: false }
      }),
      series: [{
        type: "bar",
        data: items.map((it) => ({
          value: it.value,
          itemStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 1, y2: 0,
              colorStops: it.value >= 0
                ? [{ offset: 0, color: hexA(p.bad, 0.3) }, { offset: 1, color: p.bad }]
                : [{ offset: 0, color: hexA(p.good, 0.3) }, { offset: 1, color: p.good }]
            },
            borderRadius: [0, 8, 8, 0],
            shadowBlur: 14,
            shadowColor: it.value >= 0 ? hexA(p.bad, 0.5) : hexA(p.good, 0.55)
          }
        })),
        barWidth: 14,
        label: {
          show: true,
          position: "right",
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          fontSize: 12,
          color: p.text2,
          formatter: (params) => (params.value >= 0 ? "+" : "") + params.value + "%"
        },
        showBackground: true,
        backgroundStyle: { color: hexA(p.cyan, 0.06), borderRadius: 8 },
        emphasis: {
          itemStyle: {
            shadowBlur: 24
          }
        }
      }]
    };
  }

  function policyOption() {
    const p = palette();
    const marks = D.policy.events.map((e) => ({
      name: e.name,
      coord: [e.x, 118],
      value: e.name,
      itemStyle: { color: p.warn, borderColor: p.surface, borderWidth: 2 },
      label: {
        show: true,
        position: "top",
        formatter: "★ " + e.name,
        color: p.warn,
        fontSize: 11
      }
    }));
    return {
      animationDuration: 900,
      tooltip: Object.assign(baseTooltip(p), {
        formatter: (params) => {
          const name = params[0].name;
          const evt = D.policy.events.find((e) => e.x === name);
          return name + (evt ? "<br><span style='color:" + p.warn + "'>★ " + evt.name + "</span>" : "") +
            params.map((it) => "<br>" + it.marker + " " + it.seriesName + "：" + it.value).join("");
        }
      }),
      legend: {
        top: 0,
        right: 8,
        itemGap: 18,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 3,
        textStyle: { color: p.text2, fontSize: 12 }
      },
      grid: { left: 12, right: 16, top: 50, bottom: 8, containLabel: true },
      xAxis: Object.assign(baseAxis(p), { type: "category", boundaryGap: false, data: D.policy.x }),
      yAxis: [
        Object.assign(baseAxis(p), {
          type: "value",
          name: "指数",
          nameTextStyle: { color: p.text3, fontSize: 10 },
          splitNumber: 4
        }),
        Object.assign(baseAxis(p), {
          type: "value",
          name: "热度",
          nameTextStyle: { color: p.text3, fontSize: 10 },
          min: 0,
          max: 100,
          splitLine: { show: false },
          splitNumber: 4
        })
      ],
      series: [
        {
          name: "AI板块指数",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          data: D.policy.market,
          lineStyle: {
            width: 2.8,
            color: beamGradient(p),
            shadowBlur: 14,
            shadowColor: hexA(p.cyan, 0.85)
          },
          itemStyle: { color: p.cyan, shadowBlur: 12, shadowColor: hexA(p.cyan, 0.9) },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexA(p.cyan, 0.26) },
                { offset: 1, color: hexA(p.accent, 0.02) }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 3.4, shadowBlur: 22, shadowColor: hexA(p.cyan, 1) }
          },
          markPoint: {
            data: marks,
            itemStyle: {
              shadowBlur: 14,
              shadowColor: hexA(p.warn, 0.85),
              borderColor: p.surface,
              borderWidth: 1.5
            }
          }
        },
        {
          name: "政策热度指数",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbol: "none",
          data: D.policy.policyHeat,
          lineStyle: {
            width: 1.8,
            color: hexA(p.cyan, 0.7),
            type: "dashed",
            shadowBlur: 8,
            shadowColor: hexA(p.cyan, 0.45)
          },
          itemStyle: { color: p.cyan }
        }
      ]
    };
  }

  function sentimentOption() {
    const p = palette();
    return {
      animationDuration: 1200,
      series: [{
        type: "gauge",
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        radius: "92%",
        center: ["50%", "56%"],
        progress: {
          show: true,
          roundCap: true,
          width: 14,
          itemStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: p.warn },
                { offset: 0.5, color: p.cyan },
                { offset: 1, color: p.good }
              ]
            },
            shadowBlur: 18,
            shadowColor: hexA(p.cyan, 0.85)
          }
        },
        axisLine: {
          roundCap: true,
          lineStyle: { width: 14, color: [[1, hexA(p.cyan, 0.08)]] }
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          length: 10,
          lineStyle: { color: hexA(p.cyan, 0.4), width: 1.5 }
        },
        axisLabel: { show: false },
        title: {
          offsetCenter: [0, "28%"],
          fontSize: 12,
          color: p.text3,
          fontFamily: "JetBrains Mono, monospace"
        },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, "-4%"],
          fontSize: 36,
          fontWeight: 700,
          color: p.text,
          formatter: "{value}",
          fontFamily: "JetBrains Mono, monospace"
        },
        data: [{ value: D.forecast.sentiment, name: "市场风险偏好（0-100）" }]
      }]
    };
  }

  function backtestOption() {
    const p = palette();
    return {
      animationDuration: 900,
      tooltip: Object.assign(baseTooltip(p), {
        formatter: (params) => {
          return params[0].axisValue + params.map((it) => "<br>" + it.marker + " " + it.seriesName + "：" + it.value).join("");
        }
      }),
      legend: {
        top: 0,
        right: 8,
        itemGap: 18,
        icon: "roundRect",
        itemWidth: 14,
        itemHeight: 3,
        textStyle: { color: p.text2, fontSize: 12 }
      },
      grid: { left: 12, right: 16, top: 46, bottom: 8, containLabel: true },
      xAxis: Object.assign(baseAxis(p), { type: "category", boundaryGap: false, data: D.forecast.backtest.x }),
      yAxis: Object.assign(baseAxis(p), {
        type: "value",
        min: 50,
        max: 95,
        axisLabel: Object.assign(baseAxis(p).axisLabel, { formatter: "{value}" })
      }),
      series: [
        {
          name: "模型预测",
          type: "line",
          smooth: true,
          symbol: "none",
          data: D.forecast.backtest.predicted,
          lineStyle: {
            width: 2,
            color: hexA(p.accent, 0.85),
            type: "dashed",
            shadowBlur: 10,
            shadowColor: hexA(p.accent, 0.6)
          },
          itemStyle: { color: p.accent }
        },
        {
          name: "实际走势",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: D.forecast.backtest.actual,
          lineStyle: {
            width: 2.8,
            color: p.good,
            shadowBlur: 14,
            shadowColor: hexA(p.good, 0.8)
          },
          itemStyle: { color: p.good, shadowBlur: 10, shadowColor: hexA(p.good, 0.9) },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexA(p.good, 0.22) },
                { offset: 1, color: hexA(p.good, 0.01) }
              ]
            }
          },
          emphasis: {
            lineStyle: { width: 3.4, shadowBlur: 22, shadowColor: hexA(p.good, 1) }
          }
        }
      ]
    };
  }

  function insightMiniOption() {
    const p = palette();
    return {
      animationDuration: 1000,
      grid: { left: 6, right: 6, top: 10, bottom: 6, containLabel: false },
      xAxis: Object.assign(baseAxis(p), {
        type: "category",
        boundaryGap: false,
        data: D.policy.x,
        show: false
      }),
      yAxis: Object.assign(baseAxis(p), { type: "value", show: false }),
      tooltip: Object.assign(baseTooltip(p), {
        trigger: "axis",
        formatter: (params) => params[0].axisValue + "：" + params[0].value
      }),
      series: [{
        type: "line",
        smooth: true,
        symbol: "none",
        data: D.policy.market,
        lineStyle: {
          width: 2.8,
          color: p.cyan,
          shadowBlur: 12,
          shadowColor: hexA(p.cyan, 0.85)
        },
        itemStyle: { color: p.cyan, shadowBlur: 10, shadowColor: hexA(p.cyan, 0.9) },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexA(p.cyan, 0.34) },
              { offset: 1, color: hexA(p.cyan, 0.02) }
            ]
          }
        }
      }]
    };
  }

  function graphOption(onClick) {
    const p = palette();
    const catColor = {
      "政策": p.accent,
      "产业": p.cyan,
      "资金": p.good,
      "股价": p.warn
    };
    const nodes = D.graph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      category: n.cat,
      value: n.value,
      symbolSize: 22 + n.value * 0.24,
      itemStyle: {
        color: catColor[n.cat],
        borderColor: hexA(p.cyan, 0.7),
        borderWidth: 1.5,
        shadowBlur: 16,
        shadowColor: hexA(catColor[n.cat], 0.85)
      }
    }));
    const links = D.graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      lineStyle: { color: hexA(p.cyan, 0.4), width: 1.4, curveness: 0.14 }
    }));
    const cats = D.graph.legend.map((c) => ({
      name: c.name,
      itemStyle: { color: catColor[c.name] }
    }));

    return {
      animationDuration: 900,
      tooltip: {
        backgroundColor: "rgba(9, 15, 32, 0.92)",
        borderColor: hexA(p.cyan, 0.42),
        borderWidth: 1,
        extraCssText: "box-shadow:0 0 20px rgba(54,191,250,0.26), 0 8px 30px rgba(0,0,0,0.5);border-radius:12px;backdrop-filter:blur(12px);",
        textStyle: { color: p.text, fontSize: 12, fontFamily: "JetBrains Mono, monospace" },
        formatter: (params) => {
          if (params.dataType === "edge") return "";
          return "<b>" + params.name + "</b><br>类型：" + params.data.category + "<br>事件权重：" + params.data.value;
        }
      },
      legend: [{
        show: false,
        data: cats
      }],
      series: [{
        type: "graph",
        layout: "force",
        roam: false,
        draggable: true,
        data: nodes,
        links: links,
        categories: cats,
        force: {
          repulsion: 240,
          edgeLength: [110, 190],
          gravity: 0.08,
          friction: 0.6
        },
        label: {
          show: true,
          position: "bottom",
          fontSize: 12,
          color: p.text2,
          offset: [0, 6],
          formatter: (params) => params.data.name
        },
        emphasis: {
          focus: "adjacency",
          lineStyle: {
            width: 3.5,
            color: p.cyan,
            shadowBlur: 12,
            shadowColor: hexA(p.cyan, 0.9)
          }
        },
        lineStyle: { color: hexA(p.cyan, 0.4), width: 1.4, curveness: 0.14 },
        itemStyle: {
          borderColor: hexA(p.cyan, 0.7),
          borderWidth: 1.5,
          shadowBlur: 16,
          shadowColor: hexA(p.cyan, 0.8)
        }
      }]
    };
  }

  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  function init(id, option) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (instances[id]) {
      instances[id].dispose();
    }
    const chart = echarts.init(el, null, { renderer: "canvas" });
    chart.setOption(option);
    instances[id] = chart;
    return chart;
  }

  /* 图表懒加载：进入视口才创建实例，打开页面不再一次性初始化 8 张图 */
  const pending = {
    fundChart: () => fundOption("day"),
    heatChart: () => heatOption(),
    marketChart: () => marketOption(),
    policyChart: () => policyOption(),
    sentimentChart: () => sentimentOption(),
    backtestChart: () => backtestOption(),
    insightMiniChart: () => insightMiniOption(),
    eventGraph: () => graphOption(window.CHARTS ? window.CHARTS._graphClick : null)
  };
  const hooks = {};

  function ensure(id, graphClick) {
    if (instances[id]) return instances[id];
    if (!pending[id]) return null;
    const chart = init(id, pending[id]());
    if (id === "eventGraph" && chart && (graphClick || (window.CHARTS && window.CHARTS._graphClick))) {
      const cb = graphClick || window.CHARTS._graphClick;
      chart.off("click");
      chart.on("click", (params) => {
        if (params.dataType === "node" && params.data.id) cb(params.data.id);
      });
    }
    if (hooks[id]) {
      hooks[id](chart);
      delete hooks[id];
    }
    return chart;
  }

  window.CHARTS = {
    _graphClick: null,
    initAll: function (graphClick) {
      this._graphClick = graphClick || null;
      Object.keys(pending).forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") {
          ensure(id, graphClick);
          return;
        }
        const io = new IntersectionObserver((entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            ensure(id, graphClick);
            io.disconnect();
          }
        }, { rootMargin: "200px 0px" });
        io.observe(el);
      });
    },
    ensure: function (id) {
      return ensure(id);
    },
    _onChartReady: function (id, cb) {
      hooks[id] = cb;
    },
    updateFund: function (dim) {
      const chart = ensure("fundChart");
      if (chart) chart.setOption(fundOption(dim), { notMerge: true });
    },
    exportPng: function (id, filename) {
      const chart = ensure(id);
      if (!chart) return;
      const url = chart.getDataURL({
        pixelRatio: 2,
        backgroundColor: cssVar("--surface")
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    resize: function () {
      Object.keys(instances).forEach((k) => instances[k].resize());
    },
    rebuild: function (graphClick) {
      Object.keys(instances).forEach((k) => {
        instances[k].dispose();
        delete instances[k];
      });
      this.initAll(graphClick);
    }
  };
})();

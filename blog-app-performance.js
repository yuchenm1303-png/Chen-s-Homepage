(() => {
  const articles = window.BlogArticles?.zh;
  if (!Array.isArray(articles)) return;

  const article = {
    id: 'app-performance-optimization',
    title: '不牺牲视觉效果的 App 性能优化：从 OpenGL 玻璃到 Compose 重组',
    shortTitle: 'App 性能优化：保留视觉，删除无效工作',
    date: '2026-07-13',
    size: '47 KB',
    category: 'Android 开发',
    readTime: '20 分钟阅读',
    words: '约 7600 字',
    summary: '真正有效的性能优化，不是降低画质或删除动画，而是让昂贵的渲染、重组和无障碍工作只在必要的位置、必要的时间发生。',
    body: `
      <p class="article-lead">AI Ledger 的界面同时包含原生 Jetpack Compose、OpenGL 液态玻璃、持续动画、流式消息、公式与联网数据卡片，以及任务执行期间的无障碍能力。这样的页面很容易陷入一个误区：为了追求流畅，直接削弱玻璃、减少动画、降低分辨率或简化聊天气泡。我们最终选择了另一条路线——不牺牲已经确定的视觉和交互，而是从架构上删除无效工作，让高成本能力只在真正需要的位置运行。</p>

      <h2>性能问题不是“效果太多”这么简单</h2>
      <p>页面卡顿往往不是某一个 Shader、某一个动画或某一张卡片单独造成的，而是多个成本同时叠加。OpenGL Host 需要维护上下文、纹理和几何信息；Compose 状态变化可能让父级和大量子组件一起重组；长消息会同时触发流式文本、逐字动画、公式排版和操作按钮；无障碍服务如果常驻监听窗口，又会在用户没有任务时持续消耗资源。</p>
      <p>所以，简单地问“哪个效果最耗性能”并不能解决根本问题。真正需要回答的是：</p>
      <ul>
        <li>哪些组件必须使用 OpenGL，哪些只是视觉上像玻璃；</li>
        <li>哪些状态变化真的需要刷新整块界面；</li>
        <li>哪些动画在离屏、后台或任务结束后仍然运行；</li>
        <li>哪些背景、模糊和纹理正在被重复生成；</li>
        <li>哪些服务在空闲态做了用户根本看不到的工作。</li>
      </ul>
      <blockquote>性能优化的目标不是让页面“少做效果”，而是让系统停止做那些对当前画面没有贡献的工作。</blockquote>

      <h2>先锁定不可牺牲的视觉基线</h2>
      <p>在正式优化前，我们先明确了一条规则：任何会改变最终视觉结果的性能方案，都不能默认执行。液态玻璃的圆肩、主体折射、边缘深度、按压下沉、触点光效和聊天大玻璃的稳定尺寸，都是已经确认的设计结果。优化只能改变它们的执行方式，不能把效果替换成低质量近似。</p>
      <p>这一步非常重要。没有视觉基线时，性能优化很容易退化成不断删东西：先降低模糊，再删除流光，再把 OpenGL 换成普通半透明卡片，最后虽然帧率提高了，但产品也失去了最核心的视觉特征。我们采用的判断标准是：用户应该只感到页面更稳定，而不应该看出效果被削弱。</p>

      <h2>第一层优化：严格限制 OpenGL 的使用范围</h2>
      <p>OpenGL 适合处理真正的大面积透镜容器，但不适合无差别覆盖所有玻璃元素。最初的架构里，卡片、导航、Chip、悬浮按钮和普通信息面板都可能进入 OpenGL 路径。单个组件看起来成本不高，但当页面同时出现十几甚至几十个 Host 时，上下文、纹理、几何同步和渲染循环会迅速累积。</p>
      <p>最终架构明确规定：只有真正的大玻璃容器 <code>GlassRole.Shell</code> 可以使用单卡 OpenGL。其他角色必须与 OpenGL 完全隔离：</p>
      <div class="article-code"><div class="code-title">OPENGL ROLE BOUNDARY</div><pre><code>GlassRole.Shell      → single-card OpenGL allowed
GlassRole.Card       → Compose glass only
GlassRole.Chip       → Compose glass only
GlassRole.Floating   → Compose glass only
GlassRole.Nav        → Compose glass only
GlassRole.Flex       → Compose glass only
FrostInfoGlassPanel  → no OpenGL
InsetGlassSlot       → no OpenGL</code></pre></div>
      <p>“完全隔离”不仅是不画 Shader，还包括三点：不调用 <code>OpenGLGlassCardLayer</code>，不注册到任何 OpenGL registry，也不触发 geometry sync 或 <code>requestGeometrySync</code>。只有把入口、注册和同步全部切断，才能真正消除后台成本。</p>

      <h2>为什么大玻璃适合 OpenGL，小玻璃反而不适合</h2>
      <p>大面积 Shell 有足够空间展示主体透镜、液态圆肩、边缘折射和体积暗核。用户能够感知它是一个完整光学体，因此 OpenGL 的成本有明确视觉回报。普通按钮和小信息卡面积有限，强折射反而会让界面过度拥挤；即使使用 OpenGL，用户能看到的也往往只是一圈亮边。</p>
      <p>小组件采用原生 Compose 绘制后，仍然可以保留圆角、雾面、边缘高光、按压反馈和层次感。视觉统一不等于所有组件都运行同一套 Shader。真正成熟的设计系统应该允许不同层级使用不同渲染成本。</p>

      <h2>第二层优化：背景只采样一次，不重复做模糊</h2>
      <p>玻璃最昂贵的部分之一，是获取后方背景并生成可用于折射或模糊的纹理。如果每张卡片都独立截图、模糊和上传纹理，页面复杂度会随组件数量近似线性增长。更糟糕的是，多个半透明层叠加后还容易出现脏灰、过曝和不一致的清晰度。</p>
      <p>优化后的思路是统一背景源：大玻璃从同一套背景纹理中采样，小玻璃复用已经生成的模糊结果或使用轻量 Compose 表面。背景只有在尺寸、设备像素比或实际场景发生变化时才重建；普通滚动只更新采样原点和组件位置，不重新生成整张背景。</p>
      <div class="article-code"><div class="code-title">BACKDROP PIPELINE</div><pre><code>scene background
      ↓ generate once
shared clear / blurred textures
      ├─ Shell OpenGL refraction
      ├─ lightweight Compose glass
      └─ cached backdrop sampling

scroll → update geometry only
resize / DPR change → rebuild texture</code></pre></div>
      <p>这种方式把“组件数量”与“背景生成次数”解耦。页面增加卡片时，不再意味着增加同样数量的全屏模糊和纹理上传。</p>

      <h2>第三层优化：缩小 Compose 状态读取范围</h2>
      <p>Compose 的优势是声明式 UI，但状态放置不当时，一个很小的变化也可能让大片界面重新执行。比如输入框光标、流式消息长度、模型栏展开进度或某个按钮的按压状态，如果在过高层级读取，就可能让整个首页、消息列表和玻璃容器一起重组。</p>
      <p>我们的优化不是重写页面，而是逐步收缩状态边界：</p>
      <ul>
        <li>让状态尽量在真正使用它的最低层读取；</li>
        <li>将可派生值放入 <code>derivedStateOf</code>，避免重复计算；</li>
        <li>稳定列表项的 <code>key</code> 与 <code>contentType</code>；</li>
        <li>稳定回调、配置对象和不会变化的数据模型；</li>
        <li>把持续动画从正文和长列表中隔离；</li>
        <li>避免父级为了一个局部视觉状态重新构造所有子项。</li>
      </ul>
      <p>这种优化的特点是用户几乎看不见代码变化，但重组次数和无效测量会明显减少。它比删除组件更困难，却也更接近真正的工程优化。</p>

      <h2>聊天气泡是最不能粗暴简化的区域</h2>
      <p>聊天消息不是一段普通文本。它同时承担富文本、公式、联网数据卡、流式输出、生成态、逐字效果、长回复折叠、思考提示、附件、徽标和消息操作。为了减少重组而重写 <code>MessageBubbleV2</code>，很容易在不知不觉中删除某个入口或改变父级绘制关系。</p>
      <p>因此优化前必须逐项保护现有功能链，包括：</p>
      <div class="article-code"><div class="code-title">MESSAGE BUBBLE BASELINE</div><pre><code>RichMessageContent
MessageDataCards
AnimatedMessageBubbleV2
revealedMessageIds
rememberRevealTextStateV2
GeneratingMessageContentV2
StreamingAssistantContentV2
SweepingProgressTextV2
TypewriterTrailV2
LongReplyToggleV2
ThinkingDotsV2
thinkingPearlSurface
MessageActionsV2
MessageAttachmentListV2
MessageBadgeV2</code></pre></div>
      <p>可以优化的是状态读取、参数稳定性和动画隔离；不能做的是删除、替换或降级这些功能。聊天气泡的性能问题必须在原有行为完整保留的前提下解决。</p>

      <h2>为什么父级绘制链也必须保护</h2>
      <p>消息气泡的阴影、裁切、覆盖层、流式动画和玻璃表面依赖父级绘制顺序。单独看某个子组件似乎可以拆分，但一旦改变父级 <code>graphicsLayer</code>、裁切或绘制顺序，就可能出现文字被截断、光效覆盖错误、气泡边缘消失或按压反馈错位。</p>
      <p>所以聊天区域的优化原则不是“重新组织得更干净”，而是在当前基准版本上做局部、可验证的缩减。性能代码必须服从视觉与交互链，而不能反过来迫使功能迁移到一个更简单但不等价的结构。</p>

      <h2>第四层优化：保护聊天大玻璃的稳定尺寸链</h2>
      <p>聊天主面板是一个真正的大型 OpenGL Shell。模型栏展开、键盘出现、页面压缩和窗口尺寸变化都会影响可用空间。如果让这些高度直接参与 Column 的真实布局，OpenGL Host 会不断改变尺寸，底边随动画抖动，背景采样和几何同步也会频繁重建。</p>
      <p>为了解决这个问题，项目建立了一套固定高度与视觉偏移分离的结构：</p>
      <div class="article-code"><div class="code-title">STABLE OPENGL HOST CHAIN</div><pre><code>FixedHeightOverflowSlot
modelPanelVisualHeight
modelExpandDelta
LocalOpenGLGlassSurfaceAnchor
ChatPanelV2(viewportTopInset = modelExpandDelta)
GlassPanel(... viewportTopInset = viewportTopInset)</code></pre></div>
      <p>模型栏的展开高度通过视觉偏移和 <code>viewportTopInset</code> 传递，而不是直接挤压聊天大玻璃的真实 Host 尺寸。这样模型栏可以展开，键盘也可以改变页面可视区域，但 OpenGL Shell 的几何基准保持稳定。</p>
      <div class="article-callout">
        <strong>这条链路属于性能与稳定性的共同禁区</strong>
        <span>为了减少重组、修复气泡或简化布局而破坏它，往往会换来更频繁的几何同步、纹理更新和底边抖动。</span>
      </div>

      <h2>第五层优化：让动画只在可见和需要时运行</h2>
      <p>持续动画本身不一定昂贵，真正浪费的是隐藏页面、离屏组件和后台状态仍然保持刷新。星空、光效、流式指示器和玻璃表面动画都应该与可见性和生命周期绑定。</p>
      <p>具体策略包括：</p>
      <ul>
        <li>页面进入后台时暂停不再可见的动画；</li>
        <li>离开视口的高成本 Host 释放纹理和上下文；</li>
        <li>按压光效回弹结束后停止帧循环；</li>
        <li>只有流式消息真正更新时才驱动对应动画；</li>
        <li><code>will-change</code> 或高成本合成层只在动画期间启用；</li>
        <li>恢复可见时从稳定状态继续，而不是重新创建整页。</li>
      </ul>
      <p>我们也踩过一个典型问题：优化背景更新时错误地冻结了用户仍然能看到的动态背景。虽然性能数字可能更好，但视觉连续性被破坏。后来重新明确，生命周期优化只能停止无效工作，不能擅自停止用户当前可见的效果。</p>

      <h2>第六层优化：无障碍服务保持真正的 Idle</h2>
      <p>Computer Use 需要截图、节点读取、手势和窗口信息，但这些能力只应在任务执行期间开启。无障碍服务是长期驻留组件，如果在 XML 中声明大量窗口事件或持续遍历节点，即使用户没有发起任务，应用也会保持不必要的 CPU 唤醒和系统回调。</p>
      <p>项目的低负载基准是：XML 只保留读取窗口内容、执行手势、截图和必要描述，不声明 <code>accessibilityEventTypes</code>、<code>accessibilityFlags</code>、窗口变化事件或全量掩码。运行时由 Kotlin 明确控制状态：</p>
      <div class="article-code"><div class="code-title">ACCESSIBILITY LIFECYCLE</div><pre><code>Idle
  └─ no window monitoring
  └─ no continuous node scanning

Task starts
  → switch to Working
  → observe / screenshot / inspect / act

Task ends, pauses, fails or stops
  → restore Idle immediately</code></pre></div>
      <p>这不仅降低空闲功耗，也让系统行为更容易解释：用户没有发起任务时，智能体不应持续观察界面。</p>

      <h2>为什么“只优化一半”经常比不优化更危险</h2>
      <p>性能问题通常由完整链路造成。只减少几个重组，却保留所有 OpenGL 注册；只释放纹理，却让 geometry sync 继续触发；只暂停动画，却让背景纹理仍然每帧重建，这些做法可能让代码更复杂，却没有消除主要成本。</p>
      <p>每次优化后都需要检查整条路径：</p>
      <ul>
        <li>组件是否仍然进入 OpenGL registry；</li>
        <li>不可见时是否仍然提交帧；</li>
        <li>背景是否因滚动而重复重建；</li>
        <li>局部状态是否仍然在父级读取；</li>
        <li>任务结束后无障碍是否回到 Idle；</li>
        <li>键盘、模型栏和页面压缩是否触发 Host 尺寸变化。</li>
      </ul>
      <p>优化必须从入口到生命周期完整闭合，否则留下的半套机制会成为下一次问题的来源。</p>

      <h2>我们明确放弃的几种“快速方案”</h2>
      <p>开发过程中，有几类方案看似见效快，但最终不采用：</p>
      <ol>
        <li><strong>直接降低玻璃分辨率</strong>：会让圆肩、边缘和文字附近的背景采样明显变糊；</li>
        <li><strong>把 OpenGL 全部换成普通半透明卡片</strong>：性能提高，但核心材质消失；</li>
        <li><strong>重写消息气泡为简化版本</strong>：容易丢失公式、数据卡、流式动画和操作入口；</li>
        <li><strong>用 Gradle patch 或文本替换脚本修改 Kotlin</strong>：最终运行代码与仓库源码关系不清晰；</li>
        <li><strong>通过 workflow 自动改源码</strong>：构建链开始承担业务修改，难以审计和回退；</li>
        <li><strong>让无障碍长期监听窗口</strong>：可能改善某些即时识别，但破坏空闲低负载基准。</li>
      </ol>
      <p>这些方案共同的问题是把性能成本转移成视觉、维护性或系统可信度成本。</p>

      <h2>性能优化必须直接固化到源码</h2>
      <p>首页、聊天面板、OpenGL、模型栏、联网按钮和消息气泡的修改都应直接落在 Kotlin 与 Compose 源码中。最终 APK 中运行的逻辑必须与仓库源码一致。不能依赖构建时文本替换、临时 Gradle 脚本或工作流补丁来“生成”真正代码。</p>
      <p>直接源码修改有三个好处：第一，代码审查时能看到真实架构；第二，回退到某个提交时，运行结果也随源码一起回退；第三，性能问题可以沿调用链定位，不需要先猜某个构建步骤是否偷偷改过代码。</p>

      <h2>如何验证优化真的生效</h2>
      <p>只看“感觉更流畅”不够。完整验证需要覆盖视觉、交互、生命周期和资源四个方面。</p>
      <div class="article-code"><div class="code-title">VALIDATION MATRIX</div><pre><code>视觉
- 折射、圆肩、暗核和按压光效是否保持
- 聊天气泡内容和父级绘制是否完整

交互
- 模型栏展开是否稳定
- 键盘出现与收起是否抖动
- 长回复、流式消息和附件是否正常

生命周期
- 离屏 Host 是否释放
- 后台动画是否停止
- 返回页面后是否正确恢复

系统负载
- 空闲态无障碍是否保持 Idle
- 是否仍有无意义 geometry sync
- 背景是否只在真正变化时重建</code></pre></div>
      <p>还要特别测试最容易暴露问题的组合场景：模型栏展开时弹出键盘、长回复正在流式生成时切换页面、连续滚动大量消息、任务执行中暂停与恢复，以及任务失败后检查无障碍状态。</p>

      <h2>最终形成的性能架构</h2>
      <p>经过多轮调整，整个优化体系可以概括为六条：</p>
      <ol>
        <li>只有大玻璃 Shell 使用真正的单卡 OpenGL；</li>
        <li>背景纹理统一生成并复用，滚动只同步几何；</li>
        <li>Compose 状态下沉，动画与长列表隔离；</li>
        <li>聊天气泡完整功能链和父级绘制关系保持不变；</li>
        <li>OpenGL 聊天 Host 的固定高度、anchor 和 inset 链不被真实布局挤压；</li>
        <li>无障碍与动画都严格跟随任务和可见性生命周期。</li>
      </ol>
      <p>这些原则之间不是互相独立的。OpenGL 数量减少后，背景复用才真正有效；Host 尺寸稳定后，几何同步才不会反复触发；状态下沉后，消息动画才不会带动整页重组；无障碍回到 Idle 后，应用的空闲性能才真正完整。</p>

      <h2>结语：删除无效工作，而不是删除设计</h2>
      <p>高视觉复杂度并不必然意味着低性能。真正的问题通常是同一份背景被重复处理、同一个状态被过高层读取、不可见组件仍然绘制、低成本元素错误进入高成本渲染链，以及任务结束后服务没有恢复空闲。</p>
      <p>这次优化最终没有依靠大幅降低画质，也没有牺牲聊天功能。我们做的是重新划定边界：什么必须用 OpenGL，什么不应该进入 OpenGL；什么状态只属于一个组件，什么生命周期必须在结束时关闭。性能优化做到最后，本质上不是一组零散技巧，而是一套对渲染、状态和任务边界的重新整理。</p>
    `
  };

  const existingIndex = articles.findIndex((item) => item.id === article.id);
  if (existingIndex >= 0) articles.splice(existingIndex, 1, article);
  else articles.unshift(article);
})();

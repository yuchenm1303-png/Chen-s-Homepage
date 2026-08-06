(() => {
  const articles = window.BlogArticles?.zh;
  if (!Array.isArray(articles)) return;

  const article = {
    id: 'compose-parent-bubble-rendering',
    title: '把聊天气泡材质上移到父级：Compose 父级绘制组件的实现与边界',
    shortTitle: 'Compose聊天气泡父级绘制',
    date: '2026-07-18',
    size: '22 KB',
    category: 'Android / Compose',
    readTime: '13 分钟阅读',
    words: '约 4500 字',
    summary: '子气泡继续负责内容与交互，父级统一接管玻璃材质；通过几何注册、统一坐标、可见项生命周期和批量 Canvas 绘制，降低重复渲染成本，同时保护完整消息功能链与 OpenGL Host 稳定结构。',
    body: `
      <p class="article-lead">聊天界面里真正昂贵的往往不是文字，而是文字背后的材质。每条消息都可能拥有圆角裁切、半透明填充、边缘高光、棱彩色散、生成态动画和入场渐变。如果每个气泡都独立建立一套绘制节点与图层，消息数量增加、列表滚动或流式文本持续更新时，重复的材质计算会很快放大。我们最终采用的方案不是重写聊天气泡，而是把“玻璃背景怎么画”从每个子气泡中抽离出来，交给父级统一绘制；文字、公式、附件、操作按钮和全部交互逻辑仍然留在原来的消息组件中。</p>

      <h2>这次优化真正解决的是什么</h2>
      <p>最初的气泡结构很直观：每个 <code>MessageBubbleV2</code> 自己测量尺寸、绘制玻璃背景，再绘制正文和操作区。单条消息没有问题，但列表中同时存在多条复杂消息时，每个气泡都要维护自己的材质参数、绘制缓存和动画状态。流式输出又会持续改变正文高度，使多个独立绘制节点不断失效。</p>
      <p>如果直接降低模糊、减少高光、关闭动画，性能当然会好一些，但这等于用视觉降级换取帧率，不符合项目目标。我们需要的是结构性优化：在不改变玻璃质感、不删除消息功能、不破坏 OpenGL 聊天框稳定链的前提下，减少重复工作。</p>
      <blockquote>父级绘制的核心不是“少画一点”，而是让同一类材质在同一处统一画完。</blockquote>

      <h2>不是把整个气泡搬到父级</h2>
      <p>“父级绘制”很容易被误解成让父容器接管整条消息。实际上，父级只接管可批处理的视觉底层，子组件仍然拥有自己的内容与交互。职责边界必须非常清楚：</p>
      <ul>
        <li><strong>子气泡负责</strong>：正文布局、富文本、公式、联网数据卡片、附件、徽标、长回复折叠、流式文字、生成态动画、操作按钮和点击交互；</li>
        <li><strong>父级负责</strong>：收集当前可见气泡的几何信息，在统一 Canvas 中绘制玻璃填充、边缘光学和棱彩材质；</li>
        <li><strong>Registry 负责</strong>：连接二者，保存每个可见气泡最新的边界、形状、角色和动画参数；</li>
        <li><strong>列表生命周期负责</strong>：气泡进入、移动、离开 Compose 树时，及时更新或删除注册信息。</li>
      </ul>

      <div style="margin:30px 0;border:1px solid rgba(255,255,255,.16);border-radius:24px;overflow:hidden;background:rgba(9,7,28,.38);box-shadow:inset 0 1px rgba(255,255,255,.08)">
        <svg viewBox="0 0 920 520" role="img" aria-label="聊天气泡父级绘制架构图" style="display:block;width:100%;height:auto">
          <defs>
            <linearGradient id="parentCard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ff7fc8" stop-opacity=".30"/>
              <stop offset=".55" stop-color="#9b7dff" stop-opacity=".22"/>
              <stop offset="1" stop-color="#69ddff" stop-opacity=".26"/>
            </linearGradient>
            <linearGradient id="childCard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>
              <stop offset="1" stop-color="#ffffff" stop-opacity=".06"/>
            </linearGradient>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill="#d9c9ff"/>
            </marker>
          </defs>
          <rect x="30" y="28" width="860" height="464" rx="34" fill="url(#parentCard)" stroke="#ffffff" stroke-opacity=".22"/>
          <text x="62" y="74" fill="#fff" font-size="25" font-weight="700">父级聊天绘制容器</text>
          <text x="62" y="104" fill="#e8ddff" font-size="15">统一坐标系 · 可见气泡 Registry · 单个 Canvas 批量材质绘制</text>

          <rect x="68" y="146" width="220" height="118" rx="22" fill="url(#childCard)" stroke="#ffffff" stroke-opacity=".24"/>
          <text x="92" y="180" fill="#fff" font-size="19" font-weight="700">子气泡 A</text>
          <text x="92" y="209" fill="#e8ddff" font-size="14">正文 / 公式 / 附件</text>
          <text x="92" y="234" fill="#e8ddff" font-size="14">上报 bounds + visual state</text>

          <rect x="68" y="302" width="220" height="118" rx="22" fill="url(#childCard)" stroke="#ffffff" stroke-opacity=".24"/>
          <text x="92" y="336" fill="#fff" font-size="19" font-weight="700">子气泡 B</text>
          <text x="92" y="365" fill="#e8ddff" font-size="14">流式内容 / 操作区</text>
          <text x="92" y="390" fill="#e8ddff" font-size="14">离开布局时主动注销</text>

          <rect x="370" y="197" width="210" height="172" rx="24" fill="#17112f" fill-opacity=".70" stroke="#c9a8ff" stroke-opacity=".48"/>
          <text x="405" y="236" fill="#fff" font-size="20" font-weight="700">Bubble Registry</text>
          <text x="400" y="271" fill="#e8ddff" font-size="14">messageId</text>
          <text x="400" y="296" fill="#e8ddff" font-size="14">bounds / shape</text>
          <text x="400" y="321" fill="#e8ddff" font-size="14">alpha / phase / role</text>
          <text x="400" y="346" fill="#e8ddff" font-size="14">仅保存当前可见项</text>

          <rect x="655" y="197" width="200" height="172" rx="24" fill="#12283a" fill-opacity=".66" stroke="#76e6ff" stroke-opacity=".55"/>
          <text x="695" y="236" fill="#fff" font-size="20" font-weight="700">Parent Canvas</text>
          <text x="685" y="271" fill="#d9f7ff" font-size="14">按统一坐标遍历</text>
          <text x="685" y="296" fill="#d9f7ff" font-size="14">批量绘制玻璃背景</text>
          <text x="685" y="321" fill="#d9f7ff" font-size="14">子内容随后正常显示</text>
          <text x="685" y="346" fill="#d9f7ff" font-size="14">不接管交互与布局</text>

          <path d="M288 205 C330 205 330 238 370 238" fill="none" stroke="#d9c9ff" stroke-width="3" marker-end="url(#arrow)"/>
          <path d="M288 361 C330 361 330 328 370 328" fill="none" stroke="#d9c9ff" stroke-width="3" marker-end="url(#arrow)"/>
          <path d="M580 283 L655 283" fill="none" stroke="#8feaff" stroke-width="3" marker-end="url(#arrow)"/>
          <text x="324" y="188" fill="#d9c9ff" font-size="13">注册 / 更新</text>
          <text x="599" y="263" fill="#a6efff" font-size="13">快照</text>
          <text x="62" y="467" fill="#d8cbea" font-size="14">绘制顺序：父级材质背景 → 子气泡正文与交互内容</text>
        </svg>
      </div>

      <h2>第一步：定义最小化的绘制记录</h2>
      <p>父级不需要知道一条消息的完整业务数据。它只需要完成材质绘制所必需的信息。记录越小，列表更新时传播的状态越少，也越不容易把正文流式变化扩散到整个父级。</p>
      <div class="article-code"><div class="code-title">SIMPLIFIED RENDER ENTRY</div><pre><code>@Immutable
data class BubbleRenderEntry(
    val messageId: String,
    val bounds: Rect,
    val shape: Shape,
    val isUser: Boolean,
    val isGenerating: Boolean,
    val entranceAlpha: Float,
    val materialAlpha: Float,
    val phaseOffset: Float
)</code></pre></div>
      <p>这里的代码是结构化示意，而不是要求所有参数都必须以同样的名称出现。关键在于：父级记录的是“如何画”，而不是“消息说了什么”。正文、附件列表、引用关系和按钮状态都不应进入材质 Registry。</p>
      <p><code>messageId</code> 必须稳定，用来区分 LazyColumn 中不断复用的项；<code>bounds</code> 表示已经换算到父级坐标系的矩形；<code>shape</code> 保证背景裁切和子气泡圆角一致；透明度与相位参数则让入场、生成态和流光仍然可以逐气泡变化。</p>

      <h2>第二步：子气泡只上报几何和视觉状态</h2>
      <p>子气泡在完成布局后取得自己的 <code>LayoutCoordinates</code>，将矩形换算为父级坐标，再向 Registry 提交。更新逻辑需要避免每次布局回调都无条件写入状态：如果边界与视觉参数没有实质变化，就不产生新快照。</p>
      <div class="article-code"><div class="code-title">CHILD REGISTRATION</div><pre><code>Modifier.onGloballyPositioned { childCoordinates -&gt;
    val parentCoordinates = parentAnchor.coordinates ?: return@onGloballyPositioned
    val boundsInParent = parentCoordinates.localBoundingBoxOf(childCoordinates)

    registry.updateIfChanged(
        BubbleRenderEntry(
            messageId = message.id,
            bounds = boundsInParent,
            shape = bubbleShape,
            isUser = message.isUser,
            isGenerating = isGenerating,
            entranceAlpha = entranceAlpha,
            materialAlpha = materialAlpha,
            phaseOffset = phaseOffset
        )
    )
}</code></pre></div>
      <p>真正重要的是 <code>localBoundingBoxOf</code> 所代表的坐标转换关系。父级 Canvas 只能理解自己的局部坐标。如果子组件直接上报屏幕坐标、窗口坐标或 LazyColumn 内部坐标，背景在静止时可能看似正确，一旦页面滚动、键盘弹出或父容器位移，就会立即错位。</p>

      <h2>统一坐标系是整套方案的地基</h2>
      <p>父级绘制最常见的问题不是 Shader，而是坐标。Compose 同时存在组件局部坐标、父布局坐标、根布局坐标和窗口坐标。它们在某个静止截图中可能恰好相等，却会在状态变化后分离。</p>
      <p>我们遵守的规则是：父级 Canvas 与所有注册矩形必须来自同一个锚点。父容器记录自己的 <code>LayoutCoordinates</code>；子气泡只通过这个锚点进行转换；父级绝不再二次叠加列表滚动量或屏幕偏移。坐标只转换一次，随后直接进入绘制。</p>
      <div class="article-callout">
        <strong>判断坐标是否正确的方法</strong>
        <span>不要只看静止页面。连续测试列表滚动、键盘展开、模型栏展开、窗口尺寸变化和消息高度增长；只要背景始终贴合正文容器，坐标链才真正成立。</span>
      </div>

      <h2>第三步：Registry 只保存当前需要绘制的气泡</h2>
      <p>Registry 本质上是一张以稳定消息 ID 为键的可见项表。它需要支持注册、差异更新和删除，但不应该成为第二套消息状态仓库。一个稳妥的实现会在提交前比较旧记录，只在矩形或材质参数超过必要阈值时更新，从而避免微小浮点抖动不断触发父级重绘。</p>
      <div class="article-code"><div class="code-title">REGISTRY RESPONSIBILITY</div><pre><code>class BubbleRenderRegistry {
    fun updateIfChanged(entry: BubbleRenderEntry)
    fun remove(messageId: String)
    fun snapshot(): List&lt;BubbleRenderEntry&gt;
}</code></pre></div>
      <p>父级读取的应当是一份稳定快照。遍历顺序要与消息视觉顺序一致，必要时保留 zIndex 或列表索引，避免两个气泡在动画重叠时出现前后关系翻转。Registry 的目标是缩小状态读取范围，而不是引入更复杂的全局状态。</p>

      <h2>第四步：组件离开时必须主动注销</h2>
      <p>LazyColumn 会随着滚动不断创建和回收消息项。子气泡已经离开 Compose 树，并不意味着父级自动知道它不该再绘制。如果 Registry 仍保留旧矩形，就会看到悬空玻璃、滚动残影，或者某条新消息复用了旧位置。</p>
      <div class="article-code"><div class="code-title">LIFECYCLE CLEANUP</div><pre><code>DisposableEffect(message.id, registry) {
    onDispose {
        registry.remove(message.id)
    }
}</code></pre></div>
      <p>注销必须与稳定 ID 绑定，而不是与列表位置绑定。索引会随着插入、删除和历史消息加载发生变化，只有消息 ID 能长期代表同一条内容。注册与注销形成完整闭环后，父级绘制层才不会积累不可见对象。</p>

      <h2>第五步：父级 Canvas 一次完成材质背景</h2>
      <p>父容器通常使用一个覆盖消息区域的 Canvas。它读取 Registry 快照，按照顺序绘制每条可见气泡的玻璃背景。随后，正常的 Compose 子树再绘制正文和交互内容。</p>
      <div class="article-code"><div class="code-title">PARENT DRAW PASS</div><pre><code>Canvas(Modifier.matchParentSize()) {
    registry.snapshot().forEach { entry -&gt;
        drawBubbleMaterial(
            bounds = entry.bounds,
            shape = entry.shape,
            isUser = entry.isUser,
            isGenerating = entry.isGenerating,
            alpha = entry.entranceAlpha * entry.materialAlpha,
            phase = entry.phaseOffset
        )
    }
}</code></pre></div>
      <p>这段结构的重点不是函数名，而是绘制顺序。父级 Canvas 位于内容下方，只画背景；气泡自身的文本、附件和按钮位于上方，仍由原组件负责。这样既能获得统一批处理，也不会让父级承担复杂的点击命中、语义树和文本测量。</p>
      <p>每条气泡仍然可以拥有独立相位。用户消息和 AI 消息可以使用不同的材质参数，生成态也可以保留呼吸或扫光。统一绘制不等于所有气泡同步成一整块，它只是把执行入口集中起来。</p>

      <h2>为什么这种结构能够降低负担</h2>
      <p>父级绘制不会神奇地减少屏幕上必须出现的像素，但它减少了重复组织这些像素的成本。原来每条气泡都可能创建独立绘制节点、裁切链、缓存和动画读取；现在同类材质在同一 Canvas 中完成，父级可以共享画笔、路径策略和时间基准。</p>
      <ul>
        <li>减少大量重复的 <code>drawWithCache</code> 与独立图层；</li>
        <li>材质参数和时间相位在同一绘制阶段读取，避免每条消息各自启动高频状态；</li>
        <li>只遍历 LazyColumn 当前保留的可见项，不处理完整历史消息；</li>
        <li>流式文字更新主要影响子气泡内容，父级只在边界真正变化时更新几何；</li>
        <li>统一的裁切和材质入口更容易做缓存、对象复用和失效范围控制。</li>
      </ul>
      <p>这类优化的价值不是某一个 API 调用少了多少，而是重组失效路径。正文变化不再自动等于每个材质节点都重新组织一遍，列表滚动也不需要多个彼此独立的光学层同时维护状态。</p>

      <h2>为什么不能顺手重写 MessageBubbleV2</h2>
      <p>聊天气泡并不是一块背景加一段文字。当前功能链包含富文本与公式渲染、联网和实时数据卡片、逐字出现、流式内容、生成态提示、长回复折叠、思考动画、操作按钮、附件和徽标。为了追求更少重组而简化父子关系，很容易把已经稳定的功能一起删掉。</p>
      <p>因此，优化前必须逐项保护这些入口和行为：</p>
      <ul>
        <li><code>RichMessageContent</code> 与 <code>MessageDataCards</code>；</li>
        <li><code>AnimatedMessageBubbleV2</code>、<code>revealedMessageIds</code> 与 <code>rememberRevealTextStateV2</code>；</li>
        <li><code>GeneratingMessageContentV2</code>、<code>StreamingAssistantContentV2</code> 与 <code>SweepingProgressTextV2</code>；</li>
        <li><code>TypewriterTrailV2</code>、<code>LongReplyToggleV2</code> 与 <code>ThinkingDotsV2</code>；</li>
        <li><code>thinkingPearlSurface</code>、<code>MessageActionsV2</code>、<code>MessageAttachmentListV2</code> 与 <code>MessageBadgeV2</code>。</li>
      </ul>
      <p>父级绘制优化只允许缩小状态读取范围、稳定参数和合并材质入口，不能用更简单的组件替代这些功能。否则帧率可能暂时上升，但产品能力已经发生了实质退化。</p>

      <h2>父级气泡绘制与 OpenGL Shell 是两套边界</h2>
      <p>聊天大玻璃的 OpenGL Host 有自己独立的稳定系统。模型栏展开、键盘变化和页面压缩时，Host 不能被真实布局高度直接挤压，否则底边会抖动。父级气泡材质优化不能借机改动这条尺寸与锚点链。</p>
      <div class="article-code"><div class="code-title">PROTECTED OPENGL HOST CHAIN</div><pre><code>FixedHeightOverflowSlot
modelPanelVisualHeight
modelExpandDelta
LocalOpenGLGlassSurfaceAnchor
ChatPanelV2(viewportTopInset = modelExpandDelta)
GlassPanel(viewportTopInset = viewportTopInset)</code></pre></div>
      <p>这条链负责稳定聊天框的大玻璃 Shell；气泡父级 Canvas 负责消息列表内部的小型材质背景。二者可以同时存在，但职责不能混用。尤其不能为了气泡性能去改变 OpenGL Host 的真实高度、anchor 或 <code>viewportTopInset</code>。</p>
      <p>项目中的 OpenGL 角色也保持严格边界：只有真正的大玻璃容器 <code>GlassRole.Shell</code> 使用单卡 OpenGL；普通卡片、Chip、Floating、Nav、Flex、雾面信息面板、凹槽和普通按钮都不调用 <code>OpenGLGlassCardLayer</code>，不进入 OpenGL registry，也不触发 geometry sync。气泡父级绘制本身不应把这些小组件重新接入 OpenGL。</p>

      <h2>最容易出现的六类问题</h2>
      <ol>
        <li><strong>坐标系混用</strong>：背景在静止时正确，滚动或键盘变化后发生偏移；</li>
        <li><strong>注销缺失</strong>：列表回收后留下幽灵玻璃或旧位置残影；</li>
        <li><strong>稳定 ID 错误</strong>：使用列表索引作为键，插入消息后材质对应错乱；</li>
        <li><strong>布局回调无条件写状态</strong>：每次测量都生成新对象，引发测量、更新、重绘循环；</li>
        <li><strong>形状参数不一致</strong>：父级圆角与子内容裁切不同，边缘露出细线；</li>
        <li><strong>绘制层级错误</strong>：父级材质盖在文字上方，导致文本发灰、点击区域异常或附件被遮挡。</li>
      </ol>
      <p>这些问题通常不能靠继续叠加偏移量、延迟刷新或额外裁切来修补。最可靠的处理方式是回到根链：统一锚点、稳定键、差异更新、完整生命周期和正确绘制顺序。</p>

      <h2>验证不能只看一张截图</h2>
      <p>父级绘制组件属于动态架构，静态截图只能验证某一帧。完成修改后，需要把整个聊天链连续跑一遍：</p>
      <ul>
        <li>快速上下滚动长消息列表，确认没有残影和错位；</li>
        <li>发送新消息并观察入场动画，确认玻璃与正文同步出现；</li>
        <li>持续流式输出长回复，确认高度增长时边界更新平滑；</li>
        <li>展开和收起模型栏，检查 OpenGL 聊天大玻璃底边是否稳定；</li>
        <li>弹出和关闭键盘，检查父级坐标锚点是否保持一致；</li>
        <li>分别验证公式、联网卡片、附件、长回复折叠和消息操作区；</li>
        <li>切换生成态与完成态，确认独立 alpha、相位和材质参数没有串项；</li>
        <li>观察空闲状态，确认不存在无意义的持续几何同步或高频重绘。</li>
      </ul>
      <p>性能检查也必须与视觉检查同时进行。帧率更高但边缘高光变弱、玻璃层次消失或动画被删减，不算优化完成。目标是让用户看不出任何效果被牺牲，只感到滚动、流式输出和状态切换更稳定。</p>

      <h2>这套架构最终带来的改变</h2>
      <p>父级绘制组件把聊天气泡从“每条消息都拥有一套完整材质系统”调整为“每条消息只描述自己的几何与视觉状态，父级统一执行材质”。它没有重写消息内容，也没有触碰 OpenGL Host 的稳定尺寸链，而是把重复成本集中到一个更容易控制的绘制入口。</p>
      <p>更重要的是，这次实现确定了一条长期原则：性能优化应当沿着职责边界发生。可批处理的背景上移到父级，必须独立存在的内容保留在子级，业务功能链不因绘制优化而被重构，OpenGL Shell 也不因局部问题被牵连。只有这样，复杂聊天界面才能在继续增加公式、数据卡片、附件和视觉效果时，仍然保持可维护与稳定。</p>
    `
  };

  const existingIndex = articles.findIndex((item) => item.id === article.id);
  if (existingIndex >= 0) articles.splice(existingIndex, 1);
  articles.unshift(article);
})();

(() => {
  const articles = window.BlogArticles?.zh;
  if (!Array.isArray(articles)) return;

  const article = {
    id: 'ai-listing-research',
    title: '从商品链接到可验证上架：AI 自动上架系统的证据链、实时 Schema 与浏览器执行',
    shortTitle: 'AI 自动上架：从证据链到安全执行',
    date: '2026-08-16',
    size: '42 KB',
    category: 'AI / 浏览器自动化',
    readTime: '18 分钟阅读',
    words: '约 6800 字',
    summary: '把供应商页面采集、商品事实理解、实时表单扫描、AI 决策、硬约束、Fill Plan 与浏览器执行拆成一条可验证链路，让自动上架系统在信息充分时自动推进，在不确定时明确停下，而不是盲目填写。',
    body: `
      <p class="article-lead">自动上架商品看起来像一个很直接的任务：给程序一个商品链接，让 AI 读懂商品，再把结果填进电商后台。但真正开始做以后会发现，最难的部分从来不是“让模型回答字段”，而是如何保证一个答案确实来自当前商品、确实对应当前页面上的那个字段、确实符合平台的控件约束，并且能够在浏览器里稳定写入、保存、重新打开后仍然成立。我们最终把整个问题从“自动填表”重新定义成了一个可验证的决策与执行系统。</p>

      <h2>为什么“让 AI 填 70 个字段”不是正确问题</h2>
      <p>传统脚本通常从页面 DOM 里找输入框，再把准备好的值写进去。如果表单固定、字段少、页面不变化，这种方案足够稳定。但真实电商后台并不是静态表单。不同类目会生成不同字段；同一个字段可能是输入框、下拉框、单选、多值控件或数字加单位组合；页面保存后还会重新渲染；后台可能改变 DOM id、控件结构和可见顺序。</p>
      <p>与此同时，商品资料本身也不完整。供应商页面可能只写营销文案，参数藏在图片中；同一个商品可能同时存在型号、颜色、容量和包装组合；部分字段必须从上下文推断，部分字段则绝不能猜。于是系统面对的并不是一个简单的表格映射，而是三类不确定性叠加：</p>
      <ul>
        <li><strong>商品事实不确定</strong>：资料是否真的支持某个答案；</li>
        <li><strong>字段语义不确定</strong>：当前页面上的控件究竟代表什么；</li>
        <li><strong>执行状态不确定</strong>：页面是否还是计划生成时的那个表单。</li>
      </ul>
      <blockquote>真正可靠的自动上架，不应该追求“所有字段都填上”，而应该追求“每一个被自动填写的字段都能解释为什么可以填”。</blockquote>

      <h2>最终架构：把理解、决策和执行完全拆开</h2>
      <p>系统最终形成了一条明确的分层链路。每一层只负责自己的问题，并把结果以结构化数据交给下一层：</p>
      <div class="article-code"><div class="code-title">LISTING PIPELINE</div><pre><code>Supplier / Amazon / 1688 URL
        ↓
Source Capture
  text · tables · images · customer material
        ↓
Product Evidence / Identity
        ↓
Makro Live Schema Scan
  current category · current fields · options · units · multiplicity
        ↓
Cold Resolver
  grounded AI decisions
        ↓
Hot Resolver
  cached deterministic replay
        ↓
Fill Plan
  READY / MISSING / CONFLICT / BLOCKED
        ↓
Canonical Executor
  fill → validate → Save → reopen → verify
        ↓
Product Photos
        ↓
manual Send to QC only</code></pre></div>
      <p>这个结构最重要的特点，是 AI 不直接操作浏览器。AI 只负责给出字段级决策；真正执行之前，还要经过 live schema、字段身份、option、单位、多值能力、经营规则和页面漂移检查。这样即使模型回答错误，也不会自动演化成一次不可控的页面写入。</p>

      <h2>第一层：Source Capture 先建立证据，而不是直接问模型</h2>
      <p>系统接到商品链接后，第一步不是生成标题，而是采集来源。网页可见文本、参数表格、商品图片、变体信息以及用户额外上传的资料都会进入统一的 source bundle。来源之间保留引用关系，而不是简单拼成一段超长 prompt。</p>
      <p>这样设计有两个原因。第一，模型需要知道某个结论来自哪里。例如“95 oz 水箱”“适用 1000 sq ft”“自动关机”属于不同粒度的事实，如果全部混成一段文本，后面很难判断一个字段是否真的有支持。第二，执行阶段需要重新绑定同一批证据。如果计划生成后换了商品链接或证据集，系统必须拒绝继续，而不是拿旧答案填新商品。</p>
      <p>我们把这一层理解成“商品证据层”，而不是“爬虫结果”。爬虫只负责拿到内容，证据层还要保留来源类型、引用位置、置信度和商品身份，供后续决策验证。</p>

      <h2>第二层：先识别商品身份，再谈字段答案</h2>
      <p>商品身份是整条链路的锚点。系统需要先确定当前链接描述的是什么商品、品牌是什么、主要规格是什么、选中的变体是什么，再继续处理几十个字段。否则，模型很容易把页面中推荐商品、广告、配件或其他变体的信息混入答案。</p>
      <p>这里我们特别强调“身份与字段分离”。品牌、产品类型、核心型号和变体用于确认我们正在处理哪一个商品；Description、Keywords、Material、Suitable For 等字段则属于后续决策。只有前者稳定，后者才有意义。</p>
      <p>这一原则在真实测试中非常重要。比如商品本身是除湿机，但平台类目搜索没有提供完全对应的 vertical，只能选择最接近的 Air Purifiers。此时页面会出现 CADR、Particle Filtration Efficiency 等空气净化器字段。系统不能因为页面出现了这些字段，就反过来把商品理解成空气净化器。类目是平台表单上下文，商品身份仍然由原始证据决定。</p>

      <h2>第三层：Live Schema 是系统真正的“表单合同”</h2>
      <p>我们一开始也尝试过维护固定字段列表，但很快发现这条路线不可持续。类目一变，字段就会变化；Makro 页面本身也会调整 DOM。因此最终改成实时扫描：每次任务都从当前页面提取 semantic fields，再序列化成 live schema。</p>
      <p>一个 live field 不只是 label。它至少包含：</p>
      <ul>
        <li>稳定的 attribute key；</li>
        <li>字段 label 与 section；</li>
        <li>是否 required；</li>
        <li>是否 multi-value；</li>
        <li>可执行 options；</li>
        <li>qualifier / unit options；</li>
        <li>局部 help text 与 context；</li>
        <li>真实控件结构与可定位信息。</li>
      </ul>
      <p>这份 schema 是 AI 和浏览器执行之间的合同。AI 只回答 schema 中真实存在的字段；执行器也只允许写入同一份 schema 对应的当前字段。页面发生变化时，系统重新扫描并比较 signature，一旦发现字段身份、requiredness、multiplicity 或 option contract 变化，就拒绝使用旧计划。</p>

      <h2>字段身份比字段名称更重要</h2>
      <p>在开发过程中，一个非常典型的问题是“看起来相同的字段其实不是同一个字段”。Makro 某些控件会使用形如 <code>xxx_0_value</code> 的 name。最初我们曾把这种 indexed name 当作多值字段证据，结果发现普通单值字段也大量使用相同命名方式。</p>
      <p>这会造成一个非常隐蔽的错误：生成计划时字段被标记成 multi-value，重新扫描时却是 single-value，于是两边计算出的 field id 不一致。表面上 AI 已经回答了几十个字段，Fill Plan 却突然显示“decision packet 缺少该 live field”。这不是模型性能下降，而是字段身份发生了漂移。</p>
      <p>最终修复不是给两个 id 做兼容映射，而是重新定义身份来源：是否可重复填写只能由真实 DOM 能力证明，例如已经存在多个 value slot，或者字段内部确实存在可见的 Add Value 控件。<code>_0_value</code> 本身不再具有任何 multiplicity 语义。</p>
      <div class="article-callout">
        <strong>字段身份必须来自结构，而不是命名猜测</strong>
        <span>只要一个启发式规则会改变 field id，它就不再只是“辅助判断”，而是在改变整个决策链的地址系统。</span>
      </div>

      <h2>第四层：Resolver 不负责“尽量答”，而负责给出状态</h2>
      <p>在我们的结构中，AI Resolver 输出的不是普通键值对，而是字段级 decision。每个字段都带有状态、值、单位、引用、理由和置信度。核心状态包括 READY、MISSING、REVIEW 和 CONFLICT。</p>
      <p>READY 的含义不是“模型觉得答案不错”，而是它认为当前证据足以支持一个可执行答案。MISSING 表示证据不足；CONFLICT 表示多个来源互相冲突；REVIEW 则表示有候选，但模型自己也认为应该由人确认。</p>
      <p>这种状态化输出让系统能够承认不知道。比如商品没有提供电源线长度，Cord Length 就应该是 MISSING；除湿机没有遥控器，Remote Type 不应该被凭空补成某个选项；CADR 对除湿机本身不适用，也不应该为了让表格更满而制造数据。</p>

      <h2>Cold Resolver 与 Hot Resolver 为什么要分开</h2>
      <p>AI 决策本身成本较高，而且同一份商品证据和同一份 schema 在一次任务里可能需要重复读取。我们因此把首次真实推理称为 Cold Resolver，把可复用的已验证结果称为 Hot Resolver。</p>
      <p>Cold Resolver 会真正调用模型、整理 citations 并生成 decision packet；Hot Resolver 不重新理解商品，而是在 schema、source manifest 和 identity 未变化时复用缓存。这样既减少了延迟，也避免同一任务在两个阶段因为模型随机性得到互相矛盾的答案。</p>
      <p>这不是简单的 response cache。缓存能否命中必须由完整输入合同决定，而不是只看商品 URL。商品资料、schema 或商品身份任意一项变化，都应该视为新的决策问题。</p>

      <h2>第五层：Fill Plan 才决定“这个答案能不能写”</h2>
      <p>Resolver 的 READY 仍然不能直接进入浏览器。Fill Plan 会把 decision packet 与当前 semantic fields 再次绑定，并运行平台硬约束。一个字段最终只有通过这些检查，才会变成可执行 READY。</p>
      <p>这里解决了大量模型无法可靠负责的机械问题：</p>
      <ul>
        <li>单值字段不能接收多个 values；</li>
        <li>dropdown 必须匹配当前唯一有效 option；</li>
        <li>数字值与 qualifier 必须符合当前控件结构；</li>
        <li>固定单位需要确认页面真实显示的单位；</li>
        <li>MinOQ 与 MaxOQ 必须满足业务关系；</li>
        <li>价格字段只能来自明确 seller/business 输入；</li>
        <li>必填字段缺少可靠答案时，Full Step 3 必须在任何写入发生前停止。</li>
      </ul>
      <p>所以在真实运行里，可能出现 Resolver 44 个 READY，而 Fill Plan 只有其中一部分真正 READY。这不是系统“又把答案挡掉了”，而是两个阶段在回答不同问题：Resolver 判断语义是否成立，Fill Plan 判断这个答案是否符合当前 Makro 控件合同。</p>

      <h2>单位问题暴露了“语义正确”与“控件可执行”的差异</h2>
      <p>单位是整个系统里很有代表性的边界。商品资料可能写 <code>95 oz</code>，AI 也能正确提取 value=95、qualifier=oz，但当前 Makro 字段可能是数字输入框，单位通过旁边固定文字展示，并没有独立 qualifier selector。</p>
      <p>如果 planner 只看“有没有 qualifier 控件”，就会误判这个答案无法执行。我们的修复原则不是粗暴删除单位，而是识别字段局部的固定单位：只有页面本身明确显示兼容单位时，才能把 qualifier 从结构化答案中折叠掉，仅向数字控件写入数值。</p>
      <p>对于可转换单位，转换也必须建立在明确的量纲和页面目标单位上。例如 cm 与 mm 可以确定性换算，但未知单位绝不能因为“看起来差不多”而被接受。甚至 <code>dB(A)</code> 这类带权重注释的单位也需要保守处理：页面显示 dBA 或裸 dB 时可以建立严格视觉等价，但 dB(C) 绝不能被误判成同一个单位。</p>

      <h2>多值字段的“+”不是 UI 细节，而是数据模型的一部分</h2>
      <p>Keywords、Sales Package、Other Features 等字段可能允许多个值。最初很容易把它们当成一个字符串，用加号或逗号拼起来。但这样会破坏 Makro 后台真实的数据结构：平台期待的是多个独立 slot，而不是一个含分隔符的字符串。</p>
      <p>因此，多值能力从 schema 开始就必须被保留。AI 返回多个 values；Fill Plan 验证当前字段确实支持 multiplicity；执行器先写第一个 slot，再点击字段自己的 Add Value 控件生成第二个 slot，重新扫描后继续写入。若“+”当前是 disabled，执行器会先写入当前合法值，让 React 启用添加按钮，再创建下一个 slot。</p>
      <p>这一过程说明了一个更普遍的结论：浏览器 UI 的行为状态本身也是 schema 的一部分。一个按钮是否存在、是否可见、是否 enabled，会直接影响一个结构化答案能否落地。</p>

      <h2>经营字段必须和商品事实分开</h2>
      <p>商品页面可以告诉我们颜色、材质、功能和包装，但它不能替卖家决定 Base Price、Selling Price、库存策略、Listing Status 或某些履约配置。这些字段属于 business data，不属于 product evidence。</p>
      <p>我们因此建立了明确的 business lock：经营字段只允许来自 structured business/config/rule 输入。AI 即使能“猜一个合理价格”，也不能获得执行资格。这个边界让模型不会越权替卖家做商业决定，同时也让审计更清楚——商品事实和经营配置来自完全不同的来源。</p>

      <h2>Canonical Executor：真正写入浏览器的地方只能有一个</h2>
      <p>自动化项目很容易随着功能增加出现多个执行路径：单任务一套，批量任务一套，预览一套，GUI 再来一套。短期看起来方便，长期一定会发生行为漂移。我们最终坚持一个原则：所有真实 Step 3 写入都收敛到 canonical executor。</p>
      <p>执行器拿到已经验证的 Fill Plan 后，按 section 逐个处理。每个字段执行后立即 readback 验证；一个 section 完成后 Save；随后重新打开 section，再验证持久化结果。只有“写入成功”而没有“保存后仍然存在”，不算完成。</p>
      <div class="article-code"><div class="code-title">PERSISTED ACCEPTANCE</div><pre><code>READY item
   ↓
locate current semantic field
   ↓
fill control
   ↓
readback validate
   ↓
Save section
   ↓
reopen section
   ↓
scan again
   ↓
persisted value verify</code></pre></div>
      <p>这种 Save/reopen verification 会增加执行时间，但它把“浏览器操作成功”和“平台真正接受数据”区分开。对上架系统来说，后者才是有效结果。</p>

      <h2>页面漂移必须 fail closed</h2>
      <p>AI 决策通常需要几十秒甚至更久，而浏览器页面在这段时间内可能发生变化。用户可能切换类目，另一个并发任务可能操作了标签页，平台也可能在 Save 后改变页面结构。</p>
      <p>所以执行前、暂停恢复后、每个重要持久化阶段之间，系统都会重新确认当前页面、vertical 和 schema。如果当前页面已经不是计划针对的那个 Add Listing 页面，或者 schema signature 与计划不一致，任务就停止。</p>
      <p>这里没有“尽量找一个相似字段继续”的 fallback。自动化系统最危险的错误不是停下来，而是在错误页面上自信地继续。</p>

      <h2>批量上架的核心问题不是线程数，而是浏览器所有权</h2>
      <p>单任务跑通以后，批量上架看起来只需要增加并发。但浏览器自动化里的真正难点是页面所有权：多个任务如果共享同一个长期 Edge，会同时看到多个 Makro 标签页。任何“取当前 page”“取第一个 listing tab”的逻辑都可能把 A 商品的数据写进 B 商品页面。</p>
      <p>因此每一个 Batch job 都需要明确的 target id，计划和执行阶段都只能使用自己拥有的标签页。如果 target 消失，就直接失败，不能静默接管另一个 listing tab。并发控制也不是为了单纯追求吞吐，而是为了让 prepare、Resolver 和 execution 在资源预算内稳定推进。</p>

      <h2>为什么我们一直保留 Send to QC 的人工边界</h2>
      <p>系统可以自动采集、理解、规划、填写、保存和验证，但最后提交审核仍然保持人工。这个设计不是因为按钮难点，而是因为 Send to QC 是一个明确的业务承诺边界。</p>
      <p>在此之前，所有操作仍然属于“准备 listing”；一旦提交审核，商品就进入平台后续流程。把最后一步留给人，可以让卖家在自动化完成后快速浏览结果，并保留最终确认权。技术上能自动点击，不等于产品上应该自动点击。</p>

      <h2>真实测试最重要的发现：大多数错误都不是 AI 本身</h2>
      <p>这一项目最有价值的经验之一，是不要把所有失败都归因于模型。当一次运行从几十个 READY 突然掉到十几个时，第一反应很容易是“AI 又变差了”。但真正排查后，我们发现很多严重问题来自字段身份、live schema、option 污染、单位表示、多值能力和页面状态。</p>
      <p>这改变了我们的调试顺序。现在遇到异常时，会先问：</p>
      <ul>
        <li>Source Capture 是否拿到了正确商品；</li>
        <li>live schema 是否真实反映当前 DOM；</li>
        <li>field id 在计划与执行阶段是否稳定；</li>
        <li>Resolver 的 READY 是否被 Fill Plan 的机械规则挡住；</li>
        <li>最终失败发生在语义、合同还是浏览器执行层。</li>
      </ul>
      <p>只有把错误定位到具体层，修复才不会变成不断叠加字段特例。</p>

      <h2>我们最后形成的工程原则</h2>
      <p>这套自动上架系统并没有试图消灭所有不确定性，而是把不确定性显式化。整个研究最终沉淀成几条非常稳定的原则：</p>
      <ul>
        <li><strong>Evidence first</strong>：答案必须绑定来源，不能只有模型文本；</li>
        <li><strong>Live schema first</strong>：永远针对当前真实页面规划，不维护幻想中的固定表单；</li>
        <li><strong>Stable identity</strong>：字段地址来自稳定结构，不来自脆弱 DOM 启发式；</li>
        <li><strong>AI decides, planner constrains</strong>：模型负责语义，确定性代码负责机械约束；</li>
        <li><strong>One executor</strong>：所有真实写入收敛到同一执行入口；</li>
        <li><strong>Persisted verification</strong>：Save 不是成功，reopen 后仍然正确才是成功；</li>
        <li><strong>Fail closed</strong>：不确定时停止，绝不为了完成率猜页面、猜字段、猜经营数据；</li>
        <li><strong>Human final authority</strong>：最终审核提交仍由卖家确认。</li>
      </ul>

      <h2>下一步：从“能自动上架”走向“可规模化自治”</h2>
      <p>当前系统已经不再是一个把值塞进输入框的脚本，而更接近一个具备证据链、状态机、合同验证和浏览器事务语义的 listing agent。下一阶段真正值得继续研究的，不是继续堆字段特例，而是提高自治系统本身的稳定性。</p>
      <p>包括更准确的类目匹配、更完善的 customer material 融合、更严格的字段 identity contract、更统一的单位 ontology、跨站点的 source normalization，以及批量任务中的全局资源调度。更进一步，还可以把每次运行产生的 Resolver 决策、Fill Plan、执行报告和持久化验证结果沉淀成可审计数据，用于发现平台 schema 漂移和系统长期退化。</p>
      <p>自动化真正成熟的标志，不是它看起来像人在操作浏览器，而是它知道什么时候自己可以继续，什么时候必须停下来，并且能够完整解释这两种决定。</p>

      <div class="article-callout">
        <strong>结论</strong>
        <span>从商品链接到真实上架，可靠性来自“证据 → 实时合同 → 决策 → 硬约束 → 执行 → 持久化验证”这一整条链，而不是来自某一个更强的模型或更快的浏览器脚本。</span>
      </div>
    `
  };

  if (!articles.some((item) => item && item.id === article.id)) {
    articles.unshift(article);
  }
})();

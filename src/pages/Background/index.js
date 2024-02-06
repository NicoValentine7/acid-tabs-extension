import debounce from 'lodash.debounce'; // lodashのdebounce関数をインポートしてるよ！🚀 関数の連続呼び出しを制御するために使うんだ！
import { localStorage, syncStorage } from './storageManager'; // ストレージ管理用のモジュールをインポートしてるよ！📦

// タブの色を定義してる配列だよ！🌈
const tabColors = [
  'grey', // グレー
  'yellow', // イエロー
  'blue', // ブルー
  'purple', // パープル
  'green', // グリーン
  'red', // レッド
  'pink', // ピンク
  'cyan', // シアン
  'orange', // オレンジ
];

let collapsed = false; // タブグループが折りたたまれているかどうかの状態を保持する変数だよ！📂

/**
 * すべてのウィンドウキーをクリアする関数だよ！🧹
 */
const clearAllWindowKeys = () => {
  syncStorage.removeAll('window:'); // 同期ストレージからウィンドウ関連のデータを全て削除するよ！
  localStorage.removeAll('window:'); // ローカルストレージからもウィンドウ関連のデータを全て削除するよ！
};

/**
 * 短いルールにマッチするかチェックする関数だよ！🔍
 * @param {string} rule - チェックするルールだよ
 * @returns {RegExp} - 生成された正規表現
 */
function matchRuleShort(rule) {
  var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'); // 特殊文字をエスケープする関数だよ！
  return new RegExp(rule.split('*').map(escapeRegex).join('.*')); // '*'を任意の文字列にマッチする正規表現に変換するよ！
}

/**
 * グループルールを取得する関数だよ！📚
 * @returns {Promise<Array>} - ソートされたグループルールの配列
 */
const getGroupRules = async () => {
  const groupRules = await syncStorage.get('groupRules'); // 同期ストレージからグループルールを取得するよ！
  return groupRules ? groupRules.sort((a, b) => a.key - b.key) : []; // グループルールがあればキーでソートして返すよ！なければ空の配列を返すよ！
};

/**
 * 現在のウィンドウを取得する関数だよ！🏠
 * @returns {Promise<Object>} - 現在のウィンドウオブジェクト
 */
const getCurrentWindow = async () => {
  const window = await chrome.windows.getCurrent(); // 現在のウィンドウオブジェクトを取得するよ！
  return window; // 取得したウィンドウオブジェクトを返すよ！
};

/**
 * タブグループに対するルールを取得する関数だよ！📏
 * @param {number} tabGroupId - タブグループのID
 * @returns {Promise<Object|null>} - ルールオブジェクト、またはnull
 */
const getRuleForTabGroup = async (tabGroupId) => {
  const windowGroupEntries = await localStorage.getAll(
    `window:.*:rule:.*:groupId`
  ); // ローカルストレージからタブグループIDに関連するデータを全て取得するよ！
  const match = windowGroupEntries.find(([k, v]) => v === tabGroupId); // 取得したデータの中から、指定されたタブグループIDにマッチするものを探すよ！
  if (match) {
    const [k, v] = match;
    const ruleId = k
      .replace(new RegExp('window:.*:rule:'), '')
      .replace(':groupId', ''); // マッチしたデータからルールIDを抽出するよ！
    const groupRules = await getGroupRules(); // グループルールを取得するよ！
    return groupRules.find((r) => r.id.toString() === ruleId); // ルールIDにマッチするグループルールを返すよ！
  }
  return null; // マッチするものがなければnullを返すよ！
};

/**
 * 特定のウィンドウIDに対するアシッドタブグループを取得する関数だよ！🧪
 * @param {number|null} windowId - ウィンドウID、指定しない場合はnull
 * @returns {Promise<Array>} - タブグループIDの配列
 */
const getAcidTabGroups = async (windowId = null) => {
  const pattern = windowId
    ? `window:${windowId}:rule:.*:groupId`
    : `window:.*:rule:.*:groupId`; // 指定されたウィンドウIDに基づいて検索パターンを作成するよ！
  const windowGroupEntries = await localStorage.getAll(pattern); // ローカルストレージから検索パターンにマッチするデータを全て取得するよ！
  return windowGroupEntries.map(([k, v]) => v) || []; // 取得したデータからタブグループIDの配列を作成して返すよ！
};

/**
 * IDに基づいてタブグループを取得する関数だよ！🔍
 * @param {number} id - タブグループのID
 * @returns {Promise<Object>} - タブグループオブジェクト
 */
const getTabGroup = async (id) =>
  new Promise((resolve) => chrome.tabGroups.get(id, resolve)); // 指定されたIDのタブグループオブジェクトを取得するよ！

/**
 * タブグループを更新する関数だよ！🔄
 * @param {Object} args - 更新する引数（collapsedなど）
 */
const updateTabGroups = async (args = {}) => {
  if (chrome.tabGroups) {
    // タブグループAPIが利用可能かチェックするよ！
    if (args.collapsed !== undefined) {
      collapsed = args.collapsed; // 引数でcollapsedが指定されていれば、状態を更新するよ！
    }
    const tabGroups = await getAcidTabGroups(); // アシッドタブグループを取得するよ！
    for (const tabGroupId of tabGroups) {
      // 取得したタブグループIDごとにループするよ！
      try {
        const group = await getTabGroup(tabGroupId); // タブグループオブジェクトを取得するよ！
        if (!group) {
          // タブグループが存在しなければ、次のループへスキップするよ！
          console.log('no group');
          continue;
        }
        chrome.tabGroups.update(tabGroupId, args); // タブグループを更新するよ！
        const rule = await getRuleForTabGroup(tabGroupId); // タブグループに対するルールを取得するよ！
        if (rule) updateTabGroupForRule(group.windowId, group.id, rule); // ルールがあれば、タブグループをルールに基づいて更新するよ！
      } catch (e) {
        console.error(e.stack); // エラーが発生したら、エラーメッセージをコンソールに出力するよ！
      }
    }
  }
};

/**
 * ルールに一致しないタブをグループからキックアウトするよ！🚀
 */
const kickoutNonMatchingTabs = async () => {
  const window = await getCurrentWindow();
  const tabGroups = await getAcidTabGroups();
  const rules = await getGroupRules();
  const allTabs = await chrome.tabs.query({ windowId: window.id });
  for (const tabGroupId of tabGroups) {
    const tabsInGroup = allTabs.filter((t) => t.groupId === tabGroupId);
    for (const tab of tabsInGroup) {
      const rule = checkForRuleMatch(tab.url, rules) || null;
      if (!rule) await chrome.tabs.ungroup(tab.id);
    }
  }
};

/**
 * ルールに基づいてタブの色を取得するよ！🌈
 * @param {Object} rule - ルールオブジェクト
 * @param {Array} rules - ルールの配列
 * @returns {string} - タブの色
 */
const getColorForRule = (rule, rules) => {
  if (rule.color) return rule.color;
  const index = rules.findIndex((r) => r.id === rule.id);
  const color = tabColors[index % tabColors.length];
  return color;
};

/**
 * ルールに基づいてグループIDを取得するよ！🆔
 * @param {number} windowId - ウィンドウID
 * @param {Object} rule - ルールオブジェクト
 * @returns {Promise<number>} - グループID
 */
const getGroupIdForRule = async (windowId, rule) => {
  const key = `window:${windowId}:rule:${rule.id}:groupId`;
  const ruleId = await localStorage.get(key);
  return ruleId;
};

/**
 * ルールに基づいてグループIDを設定するよ！📝
 * @param {Object} rule - ルールオブジェクト
 * @param {number} windowId - ウィンドウID
 * @param {number} groupId - グループID
 */
const setGroupIdForRule = async (rule, windowId, groupId) => {
  const key = `window:${windowId}:rule:${rule.id}:groupId`;
  await localStorage.set(key, groupId);
};

/**
 * アクティブなグループIDを取得するよ！🔍
 * @param {number} windowId - ウィンドウID
 * @returns {Promise<Array>} - アクティブなグループIDの配列
 */
const getActiveGroupIds = async (windowId) => {
  const rules = await getGroupRules();
  const groupIds = await Promise.all(
    rules.map((r) => getGroupIdForRule(windowId, r))
  );
  return groupIds.filter((gId) => !!gId) || [];
};

/**
 * すべてのタブ📑をそのウィンドウ🏠で割り当てるよ！
 * 完了したタブをクエリして、現在のウィンドウを取得した後、
 * それぞれのタブに対して処理を行い、最後にタブを整列させるんだ。
 */
const assignAllTabsInWindow = async () => {
  const tabs = await chrome.tabs.query({ status: 'complete' });
  const window = await getCurrentWindow();
  for (const tab of tabs) {
    await handleTab(tab.id);
  }
  alignTabs(window.id);
};

/**
 * URLがルール📏にマッチするかチェックするよ！
 * ルールのパターンを改行とスペースで分割して、URLがパターンにマッチするかどうかを確認するんだ。
 * マッチしたルールがあればそれを返すよ。
 *
 * @param {string} url - チェックするURL🔗だよ。
 * @param {Array} rules - チェックするルールの配列📜だよ。
 * @returns {Object|null} マッチしたルール、なければnullを返すよ。
 */
const checkForRuleMatch = (url, rules) => {
  for (const rule of rules) {
    const lineSplit = rule.pattern.split('\n');
    const patterns = lineSplit
      .reduce((prev, cur) => prev.concat(cur.split(' ')), [])
      .filter((p) => p.length)
      .map((p) => matchRuleShort(p.trim()));
    for (const pattern of patterns) {
      if (url.match(pattern)) return rule;
    }
  }
  return null;
};

/**
 * 古いウィンドウエントリ🏠をクリアするよ！
 * localStorageから古いウィンドウエントリを取得して、
 * 現在開いているウィンドウに存在しないものを削除するんだ。
 */
const clearOldWindowEntries = async () => {
  const allWindowEntries = await localStorage.getAll('window:.*:tabGroups');
  const windows = await chrome.windows.getAll();
  const oldWindowEntries = allWindowEntries.filter(
    ([k, v]) => !windows.some((w) => k.includes(`window:${w.id}:tabGroups`))
  );

  const oldKeys = oldWindowEntries.map(([k, _]) => k);
  await localStorage.remove(oldKeys);
};

/**
 * 古いエントリ🗑をクリアするよ！
 * localStorageから古いルールグループエントリを取得して、
 * 現在のルールに存在しないものを削除するんだ。
 * それに、古いグループIDに属するタブがあれば、それらをグループから外すよ。
 */
const clearOldEntries = async () => {
  const allRuleGroupEntries = await localStorage.getAll(
    'window:.*:rule:.*:groupId'
  );
  const rules = await getGroupRules();
  const oldRuleGroupEntries = allRuleGroupEntries.filter(
    ([k, v]) => !rules.some((r) => k.includes(`rule:${r.id}:groupId`))
  );

  for (const [k, groupId] of oldRuleGroupEntries) {
    const tabs = await new Promise((resolve) => chrome.tabs.query({}, resolve));
    const tabsStillInGroup = tabs.filter((t) => t.groupId === groupId);
    for (const tab of tabsStillInGroup) {
      await new Promise((resolve) => chrome.tabs.ungroup(tab.id, resolve));
    }
  }
  const oldKeys = oldRuleGroupEntries.map(([k, _]) => k);
  await localStorage.remove(oldKeys);
};

/**
 * ルール📏に基づいてタブグループ🗂を更新するよ！
 * グループIDとルールに基づいて、タブグループのタイトルと色を更新するんだ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 * @param {number} groupId - グループID🆔だよ。
 * @param {Object} rule - ルールオブジェクト📏だよ。
 */
const updateTabGroupForRule = async (windowId, groupId, rule) => {
  if (chrome.tabGroups) {
    // タブグループAPIが利用可能かチェックするよ！
    const rules = await getGroupRules(); // グループルールを取得するよ！
    const color = getColorForRule(rule, rules); // ルールに基づいて色を取得するよ！
    const group = await getTabGroup(groupId); // タブグループオブジェクトを取得するよ！
    if (!group) return; // タブグループが存在しなければ、処理を終了するよ！

    const tabs = await new Promise((resolve) =>
      chrome.tabs.query({ windowId }, resolve)
    ); // 指定されたウィンドウIDのタブを全て取得するよ！
    const tabsInGroup = tabs.filter((t) => t.groupId === groupId); // 取得したタブの中から、指定されたグループIDに属するタブをフィルタリングするよ！
    const title =
      group.collapsed && tabsInGroup.length
        ? `${rule.name} (${tabsInGroup.length})` // タブグループが折りたたまれていて、タブが1つ以上あれば、タイトルにタブの数を追加するよ！
        : rule.name; // それ以外の場合は、ルールの名前をそのままタイトルとするよ！
    chrome.tabGroups.update(groupId, { title, color }); // タブグループのタイトルと色を更新するよ！
  }
};

/**
 * タブグループ🗂を取得または作成する関数だよ！
 * 既存のグループIDがあればそれを使って、なければ新しいグループを作成するんだ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 * @param {number} tabId - タブID📑だよ。
 * @param {number} existingGroupId - 既存のグループID🆔だよ。
 * @returns {Promise<number>} グループID🆔を返すよ。
 */
const getOrCreateTabGroup = async (windowId, tabId, existingGroupId) => {
  const createProperties = existingGroupId ? undefined : { windowId }; // 既存のグループIDがあれば、新しいグループを作成しないようにするよ！
  let groupId;
  try {
    groupId = await chrome.tabs.group({
      tabIds: tabId,
      groupId: existingGroupId,
      createProperties,
    }); // タブをグループに追加するよ！既存のグループIDがあればそれを使って、なければ新しいグループを作成するよ！
  } catch (e) {
    const isNoGroupError = e.message.startsWith('No group with id'); // エラーメッセージが「No group with id」で始まるかチェックするよ！
    if (isNoGroupError) {
      const createProperties = { windowId }; // 新しいグループを作成するためのプロパティを設定するよ！
      groupId = await chrome.tabs.group({ tabIds: tabId, createProperties }); // 新しいグループを作成して、タブを追加するよ！
      return groupId; // 作成したグループIDを返すよ！
    }

    throw e; // それ以外のエラーが発生した場合は、そのままエラーを投げるよ！
  }

  return groupId; // グループIDを返すよ！
};

/**
 * タブ📑を整列させるよ！
 * タブグループ🗂をルール📏に基づいて順番に並べ替えるんだ。
 * ピン留めされたタブはそのままにして、残りのタブをルールに従って移動させるよ。
 *
 * @param {number} windowId - ウィンドウID🏠だよ。
 */
const alignTabs = async (windowId) => {
  if (chrome.tabGroups) {
    const rules = await getGroupRules();
    const orderedRules = rules.sort((a, b) => a.key - b.key);
    const currentTabGroups = await new Promise((resolve) =>
      chrome.tabGroups.query({ windowId }, resolve)
    );
    const tabs = await new Promise((resolve) =>
      chrome.tabs.query({ windowId }, resolve)
    );
    let offset = tabs.filter((t) => t.pinned).length;
    for (const r of orderedRules) {
      const groupId = await getGroupIdForRule(windowId, r);
      const tabsInGroup = tabs.filter((t) => t.groupId === groupId);
      if (currentTabGroups.some((g) => g.id === groupId)) {
        chrome.tabGroups.move(groupId, { index: offset }, () => {
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
          }
        });

        offset = offset + tabsInGroup.length;
      }
    }
  }
};

/**
 * タブ📑を処理し、適切なタブグループ🗂に割り当てる関数です。
 * タブが特定のルール📏に一致する場合、そのルールに基づいてタブグループを作成または更新します。
 * タブがドラッグ中にエラーが発生した場合、指定された回数だけリトライします。
 *
 * @param {number} tabId - 処理するタブのID🆔です。
 * @param {number} retryCount - ユーザーによるタブのドラッグ操作中にエラーが発生した場合のリトライ回数です。デフォルトは3回です。
 * @returns {Promise<void>} 処理が完了したら解決するプロミスです。
 */
const handleTab = async (tabId, retryCount = 3) => {
  try {
    const tab = await chrome.tabs.get(tabId); // タブの情報を取得します。
    const windowId = tab.windowId; // タブが属するウィンドウのIDを取得します。
    const rules = await getGroupRules(); // グループ化のルールを取得します。
    const rule = checkForRuleMatch(tab.url, rules) || null; // タブのURLがルールに一致するか確認します。
    if (rule && !tab.pinned) {
      // タブがルールに一致し、ピン留めされていない場合
      const existingGroupId = await getGroupIdForRule(windowId, rule); // 既存のグループIDを取得します。
      const groupId = await getOrCreateTabGroup(
        windowId,
        tabId,
        existingGroupId
      ); // タブグループを取得または作成するよ！

      updateTabGroupForRule(windowId, groupId, rule); // タブグループを更新するよ！
      if (existingGroupId !== groupId) {
        // 新しいグループIDが既存のものと異なる場合
        await setGroupIdForRule(rule, windowId, groupId); // 新しいグループIDを設定するよ！
      }
    } else {
      // タブがルールに一致しない場合
      const tabGroups = await getAcidTabGroups(); // タブグループを取得するよ！
      const inAcidTabGroup = tabGroups.includes(tab.groupId); // タブが特定のタブグループに含まれているか確認するよ！
      if (inAcidTabGroup) await chrome.tabs.ungroup(tab.id); // タブをグループから外すよ！
    }
  } catch (e) {
    // タブがドラッグ中にエラーが発生した場合の追加のリトライロジックだよ！
    const isTabMoveError =
      e.message ==
      'Tabs cannot be edited right now (user may be dragging a tab).'; // エラーメッセージを確認するよ！
    if (isTabMoveError && retryCount > 0) {
      // エラーがタブの移動に関連しており、リトライ回数が残っている場合
      const delay = 250 * retryCount; // リトライの遅延時間を計算するよ！
      await new Promise((res) => setTimeout(res, delay)); // 指定された時間だけ待機するよ！
      return handleTab(tabId, retryCount - 1); // リトライするよ！
    }

    console.error(e.stack); // エラーをコンソールに出力するよ！
  }
};

chrome.webNavigation.onCommitted.addListener(async ({ tabId, url }) => {
  // タブがコミットされたら、このタブを処理するんだ🚀
  handleTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  // タブが更新されたら、URLが変わったかグループが解除されたかチェックするんだ🔍
  if (changeInfo.url || changeInfo.groupId == -1) {
    handleTab(tabId);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  // タブがアクティブになったら、ちょっと多めにリトライしてみるよ🔄
  // ユーザーがまだドラッグしてる可能性が高いからね🐭
  handleTab(tabId, 5);
});

chrome.runtime.onStartup.addListener(() => {
  // 拡張機能が起動したら、古いウィンドウキーを全部消すぞ🧹
  clearAllWindowKeys();
});

// 既存の全タブをスキャンして、適切なグループに割り当てるんだ🔎
try {
  assignAllTabsInWindow();
  kickoutNonMatchingTabs();
} catch (e) {
  // 何か問題があったら、エラーをコンソールに出力するよ🚨
  console.error(e.stack);
}

chrome.action.onClicked.addListener((tab) => {
  // アクションボタンがクリックされたら、タブを再割り当てするんだ🔄
  assignAllTabsInWindow();
  kickoutNonMatchingTabs();
});

chrome.commands.onCommand.addListener((command) => {
  // コマンドが実行されたら、特定のコマンドに応じてタブグループを更新するんだ🛠
  if (command === 'toggle-collapse') {
    updateTabGroups({ collapsed: !collapsed });
  }
});

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  // メッセージが送られてきたら、内容に応じて処理するんだ📬
  try {
    if (request.updated) {
      // 更新が必要なら、ルールに合わないタブをキックアウトして、古いエントリをクリアするんだ🧹
      await kickoutNonMatchingTabs();
      await clearOldEntries();
      await clearOldWindowEntries();
      assignAllTabsInWindow();
    } else if (request.collapse) {
      // グループを折りたたむ指示があれば、そうするんだ🔽
      updateTabGroups({ collapsed: true });
    } else if (request.expand) {
      // グループを展開する指示があれば、そうするんだ🔼
      updateTabGroups({ collapsed: false });
    }
  } catch (e) {
    // 何か問題があったら、エラーをコンソールに出力するよ🚨
    console.error(e.stack);
  }
});

/**
 * タブグループが更新されたときの処理だよ！🔄
 * @param {Object} tabGroup - 更新されたタブグループ
 */
const handleTabGroupUpdate = async (tabGroup) => {
  // タブグループが更新されたら、タブを整列させて、ルールに基づいてグループを更新するんだ🛠
  alignTabs(tabGroup.windowId);
  const rules = await getGroupRules();
  for (const r of rules) {
    const gId = await getGroupIdForRule(tabGroup.windowId, r);
    if (gId === tabGroup.id) {
      updateTabGroupForRule(tabGroup.windowId, tabGroup.id, r);
      return;
    }
  }
};

if (chrome.tabGroups) {
  // タブグループがサポートされているブラウザで、タブグループが更新されたら処理するんだ👍
  chrome.tabGroups.onUpdated.addListener(
    debounce(handleTabGroupUpdate, 100, { leading: true, trailing: false })
  );
}
